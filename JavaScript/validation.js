//sign up form

const form = document.getElementById("signup-form");

// Only run validation if the form exists on this page
if (form) {
  const username_input = document.getElementById("username-input");
  const email_input = document.getElementById("email-input");
  const password_input = document.getElementById("password-input");
  const confirmPassword_input = document.getElementById(
    "confirm-password-input",
  );
  const error_message = document.getElementById("error-message");

  if (
    !username_input ||
    !email_input ||
    !password_input ||
    !confirmPassword_input
  ) {
    console.error("One or more form inputs not found");
  }

  function getSignupFormErrors(username, email, password, confirmPassword) {
    let errors = [];

    if (username.trim() === "") {
      errors.push("Username is required");
    }

    if (email.trim() === "") {
      errors.push("Email is required");
    }

    if (password.trim() === "") {
      errors.push("Password is required");
    }

    if (confirmPassword.trim() === "") {
      errors.push("Please confirm your password");
    }

    if (password !== confirmPassword) {
      errors.push("Passwords do not match");
    }

    return errors;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = username_input.value;
    const email = email_input.value;
    const password = password_input.value;
    const confirmPassword = confirmPassword_input.value;

    const errors = getSignupFormErrors(
      username,
      email,
      password,
      confirmPassword,
    );

    if (errors.length > 0) {
      error_message.textContent = errors.join(", ");
      error_message.classList.add("show");
      return;
    }

    try {
      const response = await fetch("/api/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, email, password }),
      });

      const data = await response.json();

      if (data.success) {
        alert("Signup successful! Please login.");
        window.location.href = "/HTML/TCG-home.html";
      } else {
        error_message.textContent = data.message || "Signup failed";
        error_message.classList.add("show");
      }
    } catch (error) {
      console.error("Error:", error);
      error_message.textContent = "An error occurred during signup.";
      error_message.classList.add("show");
    }
  });

  // Real-time validation on input
  const allInputs = [
    username_input,
    email_input,
    password_input,
    confirmPassword_input,
  ];
  allInputs.forEach((input) => {
    if (input) {
      input.addEventListener("blur", () => {
        const username = username_input.value;
        const email = email_input.value;
        const password = password_input.value;
        const confirmPassword = confirmPassword_input.value;
        const errors = getSignupFormErrors(
          username,
          email,
          password,
          confirmPassword,
        );

        if (errors.length > 0) {
          input.classList.add("incorrect");
        } else {
          input.classList.remove("incorrect");
        }
      });
    }
  });
}
