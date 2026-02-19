document.addEventListener("DOMContentLoaded", function () {
  const loginBtn = document.getElementById("loginbtn");
  const loginForm = document.getElementById("loginForm");
  const form = loginForm.querySelector("form");

  if (!loginBtn || !loginForm || !form) return;

  // Toggle dropdown
  loginBtn.addEventListener("click", function () {
    loginForm.classList.toggle("show");
  });

  // Close dropdown when clicking outside
  document.addEventListener("click", function (event) {
    if (!event.target.closest(".login-container")) {
      loginForm.classList.remove("show");
    }
  });

  //login form submission
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();
      if (data.success) {
        // Update button with username from server response
        updateLoginButton(data.username, {showToast: true});
        loginForm.classList.remove("show");
        form.reset();
      } else {
        alert("Login failed: " + data.message);
      }
    } catch (error) {
      console.error("Error:", error);
      alert("An error occurred during login.");
    }
    return false;
  });

  // Check if user is logged in on page load
  checkLoginStatus();
});

function updateLoginButton(username, {showToast = false} = {}) {
  const loginBtn = document.getElementById("loginbtn");
  const loginForm = document.getElementById("loginForm");

  loginBtn.textContent = `${username}`;
  loginBtn.classList.add("logged-in");
  if (showToast) {
    showNotification(`Welcome back, ${username}!`, "success");
  }
  loginForm.innerHTML =
    '<button type="button" id="logout-btn" class="logout-btn">Logout</button>';

  document
    .getElementById("logout-btn")
    .addEventListener("click", async function () {
      try {
        await fetch("/api/logout", { method: "POST" });
        loginBtn.textContent = "Login";
        loginBtn.classList.remove("logged-in");
        loginForm.classList.remove("show");
        showNotification("You have been logged out.", "info");
        location.reload();
      } catch (error) {
        console.error("Logout error:", error);
      }
    });
}

async function checkLoginStatus() {
  try {
    const response = await fetch("/api/user", {
      method: "GET",
      credentials: "include",
    });

    if (response.ok) {
      const data = await response.json();
      if (data.username) {
        updateLoginButton(data.username);
      }
    } else if (response.status === 401) {
      console.log("User not logged in");
    }
  } catch (error) {
    console.error("Error checking login status:", error);
  }
}

function showNotification(message, type = "info") {
    const notification = document.createElement("div");
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    requestAnimationFrame(() => {
      notification.classList.add("show");
    });

    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

