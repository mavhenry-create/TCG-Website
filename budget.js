let totalBudget = 0;
let spent = 0;
let wishlist = [];

// Load from localStorage on page load
window.onload = function() {
  const savedBudget = localStorage.getItem('totalBudget');
  const savedSpent = localStorage.getItem('spent');
  const savedWishlist = localStorage.getItem('wishlist');
  
  if (savedBudget) {
    totalBudget = parseFloat(savedBudget);
    document.getElementById('total-budget').value = totalBudget;
    updateBudgetDisplay();
  }
  
  if (savedSpent) {
    spent = parseFloat(savedSpent);
  }
  
  if (savedWishlist) {
    wishlist = JSON.parse(savedWishlist);
    renderWishlist();
  }
  
  updateBudgetDisplay();
};

function setBudget() {
  const budgetInput = document.getElementById('total-budget');
  const newBudget = parseFloat(budgetInput.value);
  
  if (isNaN(newBudget) || newBudget < 0) {
    alert('Please enter a valid budget amount.');
    return;
  }
  
  totalBudget = newBudget;
  localStorage.setItem('totalBudget', totalBudget);
  updateBudgetDisplay();
}

function addToWishlist() {
  const cardName = document.getElementById('card-name').value.trim();
  const cardPrice = parseFloat(document.getElementById('card-price').value);
  
  if (!cardName) {
    alert('Please enter a card name.');
    return;
  }
  
  if (isNaN(cardPrice) || cardPrice <= 0) {
    alert('Please enter a valid price.');
    return;
  }
  
  if (spent + cardPrice > totalBudget) {
    alert('This would exceed your budget!');
    return;
  }
  
  const card = { name: cardName, price: cardPrice };
  wishlist.push(card);
  spent += cardPrice;
  
  localStorage.setItem('wishlist', JSON.stringify(wishlist));
  localStorage.setItem('spent', spent);
  
  renderWishlist();
  updateBudgetDisplay();
  
  // Clear inputs
  document.getElementById('card-name').value = '';
  document.getElementById('card-price').value = '';
}

function removeFromWishlist(index) {
  const card = wishlist[index];
  spent -= card.price;
  wishlist.splice(index, 1);
  
  localStorage.setItem('wishlist', JSON.stringify(wishlist));
  localStorage.setItem('spent', spent);
  
  renderWishlist();
  updateBudgetDisplay();
}

function renderWishlist() {
  const wishlistEl = document.getElementById('wishlist');
  wishlistEl.innerHTML = '';
  
  wishlist.forEach((card, index) => {
    const li = document.createElement('li');
    li.innerHTML = `${card.name} - $${card.price.toFixed(2)} <button onclick="removeFromWishlist(${index})">Remove</button>`;
    wishlistEl.appendChild(li);
  });
}

function updateBudgetDisplay() {
  document.getElementById('current-budget').textContent = `Current Budget: $${totalBudget.toFixed(2)}`;
  document.getElementById('remaining-budget').textContent = `Remaining Budget: $${(totalBudget - spent).toFixed(2)}`;
  document.getElementById('total-spent').textContent = `Total Spent: $${spent.toFixed(2)}`;
}</content>
<parameter name="filePath">c:\Users\Mav\Projects\Pokemon TCG\budget.js