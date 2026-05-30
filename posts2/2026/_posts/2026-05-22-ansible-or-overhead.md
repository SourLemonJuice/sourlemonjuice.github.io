---
lang: "zh-Hans"
title: "重拾 Ansible 来缓解 AI Agent 管理小服务器集群的 overhead 和不确定性"
date: 2026-05-22 20:55 +0800
---

Ansible 是一套可以在中等或更多数量的 Linux 服务器环境中，定义批量自动化流程并为不同环境编写模板的工具。它在2012年发布到2015年被 Red Hat 收购，目前在 [GitHub 仓库](https://github.com/ansible/ansible) 上总计获得了 68k stars。

## 它是什么

不同于 Kubernetes 这类容器**编排**软件，诸如 Ansible 和 Salt 这类软件用于更加传统的**中小型服务器拓扑**中使用。

单说 Ansible 的话，它并不是一个面向结果或单纯的“类似 cloud init/kickstart 的虚拟机启动后的初始化器”或者“持续维持虚拟机内某个用户的密钥密码”，而是一个以传统方式自动化批量执行操作的快捷方式。

这类自动化软件分为例如 Salt(SaltStack) 在最终节点上安装 minion(agent)，主机上安装 master 控制面的 pull-based 设计，或者 Ansible 在命令发起主机上使用 SSH 直接连接到最终节点的 push-based 设计。

我相信现代软件在处理 pull-based 设计时应该不会太过麻烦，但 [SaltStack](https://en.wikipedia.org/wiki/Salt_(software)) 是一个2011年的软件…… 不想折磨自己。

## 我的用途是什么

实不相瞒，是因为见到了有人用 AI Agent 自动化一些明明很简单的事情，类似更新系统同步某个配置文件。原因是服务器集群规模有点大但又刚好处于用更高级的技术反而会造成 overhead 的处境。

当时的我觉得很嫌弃，加上前几天被用着 code-server 的朋友说我天天不管用直连、点对点VPN甚至是 Teleport 这样的反向链接的堡垒机，还在拿人嫌狗厌的 vim 顶着不高不低的延迟改配置x_x

怎么样，行动力是不是很高～（自卖自夸）

之前有人说我用 Fedora 是因为偏爱 Red Hat，可兜兜转转下来好多软件又都是出自他们之手。算啦，下面就写的轻松一点吧。

## 基础概念

[Getting started with Ansible](https://docs.ansible.com/projects/ansible/latest/getting_started/index.html)

通俗的讲 Ansible 的控制主机端比如开发用的PC（Control node）上会储存着不同的 Playbook（剧本）以类似 shell 脚本的形式储存着一步一步的 Play（演出动作）。配置文件看上去更像 GitHub/GitLab 的 CI/CD 流水线，每个 Play 中负责实施行动的 Module（模块）就像是 GitHub Actions 的 `uses: actions/xxx@v9999`。

这些 Playbook 只是一个通用的模板，至于需要应用到哪些受控节点上则需要一个简单的 Inventory（存货清单）里保存的 IP 或域名列出（真的有人会用 “完全限定域名/FQDN” 这个术语么）。

## 实际使用场景

Emm 本来想写很多使用方法在这里的，但官方的文档已经相当齐全了加上 Ansible 的 Playbook 写起来相当的符合直觉，所以这里就只放一些我的实际例子啦：

Inventory:

```yaml
# inventory.yaml
ungrouped:
  hosts:
    host1.teleport.sourlemonjuice.net:
      ansible_user: ec2-user
      codename: host1
    host2.teleport.sourlemonjuice.net:
      ansible_user: ubuntu
      codename: host2
```

Playbooks:

```yaml
# apply_security_updates.yaml
---
- name: Apply Security Updates
  hosts: all   # The "all" and "ungrouped" are special keyword
  become: true # Act as privilege(root) via sudo by default
  tasks:
    - name: Red Hat-based distro fact check
      ansible.builtin.assert:
        that: ansible_facts['os_family'] == "RedHat"

    - name: Apply DNF upgrade
      ansible.builtin.dnf:
        name: "*"
        state: latest
        security: true
        bugfix: true
```

```yaml
# push_singbox_config.yaml
---
- name: Update sing-box Config
  hosts: all
  become: true
  tasks:
    - name: Red Hat-based distro fact check
      ansible.builtin.assert:
        that: ansible_facts['os_family'] == "RedHat"

    - name: Install the latest version of sing-box
      ansible.builtin.dnf:
        name: sing-box-1.13.*
        state: latest

    - name: Guarantee the sing-box config dir is secure
      ansible.builtin.file:
        path: /etc/sing-box
        owner: root
        group: root
        mode: "0700"

    - name: Copy the configuration file
      ansible.builtin.copy:
        src: configs/{{ codename }}.json
        dest: /etc/sing-box/config.json
        owner: root
        group: root
        mode: "0600"

    - name: Restart service sing-box
      ansible.builtin.service:
        name: sing-box
        state: restarted
```

And run it:

```shell
ansible-playbook -i inventory.yaml apply_security_updates.yaml
```

如果主机列表中有的登录用户的 sudo 需要密码的话，事情会变得复杂一些。下文会提到一点。

## 理念和学习感受

Playbook 的编写是在描述一步步达成最终目标的过程，但相比于 shell 脚本 Ansible 抹去了中间每一步 module 中的繁文缛节以及头痛的错误处理和消息输出。每个步骤报错了就退出再把错误原因输出出来，成功了也有适量的日志反馈，可以说 built-in modules 对于掌控感的理解让 Ansible 整体的使用舒适度远超了 shell 脚本。

但对于登录后切换用户提权的处理虽然灵活但稍显补丁加补丁。虽然 become 这个功能背后的理念和灵活度非常之高，但在用户切换器（sudo）需要密码的情况下就很难办了。`ansible-playbook` 命令行的 `--ask-become-pass` flag 虽然可以提供密码，但只能应用到所有主机；明文写在 inventory 文件中也固然可行，但并不安全；Ansible Vault 用了一套 AES 对称加密做到了在 Playbook, Inventory 中~~无缝~~中缝静态存储 secret，或者存到外部的独立文件里也行。

但是想不到吧，所有 vault 静态加密的密码只能用 `--ask-vault-pass` 在程序执行的开始询问一次并应用到所有需要解密的地方。虽然合理，但是感觉还是缝缝补补，不过如果是设计使然也有可能。

* [Understanding privilege escalation: become](https://docs.ansible.com/projects/ansible/latest/playbook_guide/playbooks_privilege_escalation.html)
* [Protecting sensitive data with Ansible vault](https://docs.ansible.com/projects/ansible/latest/vault_guide/index.html)

---

感觉我已经好久没见到信息量超高但不头晕眼花的文档了，信息整理的相当有条理，该有的 example 也到处都是。配上简单的编写逻辑无论是上手速度还是学习曲线都相当顺滑，我甚至想用温柔来形容。

当然中间 AI 也在持续的帮忙啦，但比如 `ansible_os_family` 这种老式写法（新：`ansible_facts['os_family']`）仍然需要自己检查出来。而在 AI 之外用搜索引擎在简单到中等的问题上也能找到相当详尽的答案，或者说这是因， AI 是果。总之总之，社区资源还是很丰富的
