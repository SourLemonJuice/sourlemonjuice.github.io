const PRIVACY_STATE_TTL_MONTHS = 2

// Try to remove the legacy key
function dropLegacy() {
  localStorage.removeItem("acceptPrivacyPolicy")
}

function loadTrackers(privacyState) {
  if (privacyState.analytics === true) {
    window.dataLayer = window.dataLayer || []
    function gtag() { dataLayer.push(arguments) }
    gtag('js', new Date())
    gtag('config', 'G-7Q9ES4DJXS')
  }
}

function refreshInquiryTime() {
  const now = new Date()
  localStorage.setItem("privacyLastInquiryDate", now.toISOString())
}

function inquiryPrivacyState() {
  let state = {
    analytics: false
  }

  const dialog = document.getElementById("privacyDialog")
  dialog.show()

  dialog.addEventListener("close", () => {
    switch (dialog.returnValue) {
      case "accept":
        state.analytics = true
        localStorage.setItem("privacyState", JSON.stringify(state))
        break
      case "necessary":
        localStorage.setItem("privacyState", JSON.stringify(state))
        break
      default:
        console.error(
          `unexpected value from privacy dialog: ${dialog.returnValue}`,
        )
        return
    }
    refreshInquiryTime()
    loadTrackers(state)
  })
}

function privacyDialogMain() {
  dropLegacy()

  // If those null values and underflow happened in C:
  // heart_attack * INT_MAX

  const expirationDate = new Date()
  expirationDate.setMonth(expirationDate.getMonth() - PRIVACY_STATE_TTL_MONTHS)
  let lastInquiry = new Date(localStorage.getItem("privacyLastInquiryDate"))

  if (!isNaN(lastInquiry.valueOf()) && lastInquiry > expirationDate) {
    // aka, if not expired
    let stateJSON = localStorage.getItem("privacyState")
    try {
      let state = JSON.parse(stateJSON)
      loadTrackers(state)
      return
    } catch (error) {
      console.warn(`The storage privacyState has invalid JSON format: ${error}`)
      console.warn("Fallback to privacy inquiry.")
    }
  }

  inquiryPrivacyState()
}

privacyDialogMain()
let button = document.getElementById("manage-cookies-button")
button.addEventListener("click", inquiryPrivacyState)
