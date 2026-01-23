// Pokemon TCG API configuration
const POKEMON_TCG_API_KEY = "faaf3ff7-6ffe-4cf3-b89f-62442025d16f";
const POKEMON_TCG_API_BASE = "https://api.pokemontcg.io/v2";
const EUR_TO_USD_RATE = 0.92; // Fixed conversion rate for EUR pricing display
const USD_TO_CAD_RATE = 1.38; // Fixed conversion rate for CAD pricing display

// Global variables to store search results and current state
let allCards = [];
let currentPage = 1;
let cardsPerPage = 60; // Default, can be changed by user
let setsMap = {}; // Map of set IDs to names

// Function to extract USD price from Pokemon TCG API pricing data
function extractUSDPrice(card) {
  if (!card || !card.tcgplayer || !card.tcgplayer.prices) return 0;

  const prices = card.tcgplayer.prices;

  // Try different price variants in order of preference
  const variants = [
    "holofoil",
    "reverseHolofoil",
    "normal",
    "1stEditionHolofoil",
    "unlimitedHolofoil",
    "unlimited",
    "1stEdition",
  ];

  for (const variant of variants) {
    if (prices[variant]?.market) {
      return prices[variant].market;
    }
  }

  return 0;
}

// Function to search for cards based on user input
async function searchCards() {
  try {
    // Get the user's input from the text field
    const pokemonCard = document.getElementById("pokemonCard").value.trim();

    // Check if user has selected specific sets
    const selectedSets = window.selectedSets || [];

    // Build query for Pokemon TCG API
    let query = "";

    // Add set filter if sets are selected
    if (selectedSets.length > 0) {
      const setQuery = selectedSets
        .map((setId) => `set.id:${setId}`)
        .join(" OR ");
      query = `(${setQuery})`;
    }

    // Add name filter if provided
    if (pokemonCard) {
      const nameQuery = `name:"*${pokemonCard}*"`;
      query = query ? `${nameQuery} AND ${query}` : nameQuery;
    }

    console.log("Searching with query:", query);
    console.log("Selected sets:", selectedSets);

    // Fetch cards from Pokemon TCG API
    const apiUrl = query
      ? `${POKEMON_TCG_API_BASE}/cards?q=${encodeURIComponent(query)}&pageSize=250`
      : `${POKEMON_TCG_API_BASE}/cards?pageSize=250`;

    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    const cards = data.data || [];

    if (cards && cards.length > 0) {
      console.log(`Found ${cards.length} cards`);

      // Store cards globally for filtering/sorting/pagination
      allCards = cards;

      // Reset to first page
      currentPage = 1;

      // Show controls
      document.getElementById("card-main-controls").style.display = "block";

      // Add price check button if not already there
      let priceCheckBtn = document.getElementById("removeSelectedBtn");
      if (!priceCheckBtn) {
        priceCheckBtn = document.createElement("button");
        priceCheckBtn.id = "removeSelectedBtn";
        priceCheckBtn.textContent = "Price Check Selected";
        priceCheckBtn.onclick = removeSelectedCards;
        priceCheckBtn.style.marginLeft = "20px";
        document
          .getElementById("card-main-controls")
          .appendChild(priceCheckBtn);
      }

      // Apply current filters and display
      await applyFilters();
    } else {
      // No cards found
      allCards = [];
      document.getElementById("card-main-controls").style.display = "none";
      document.getElementById("pagination").style.display = "none";

      let cardContainer;
      if (document.getElementById("card-display-test")) {
        cardContainer = document.getElementById("card-display-test");
      } else if (document.getElementById("cards-search-results-list")) {
        cardContainer = document.getElementById("cards-search-results-list");
      } else {
        cardContainer = document.getElementById("card-display-test");
      }
      cardContainer.innerHTML =
        "<p>No cards found matching: " + pokemonCard + "</p>";
    }
  } catch (error) {
    console.error("Error searching cards:", error);
    alert("An error occurred while searching. Check the console for details.");
  }
}

// Function to apply sorting and filtering
async function applyFilters() {
  if (allCards.length === 0) return;

  const sortOrder = document.getElementById("sortOrder").value;
  const currencyFilter = document.getElementById("currencyFilter").value;

  let filteredCards = allCards;

  console.log(`Applying filters to ${filteredCards.length} cards`);

  // Apply sorting if selected
  if (sortOrder !== "none") {
    filteredCards.sort((a, b) => {
      const priceA = extractUSDPrice(a);
      const priceB = extractUSDPrice(b);
      return sortOrder === "high-to-low" ? priceB - priceA : priceA - priceB;
    });
  }

  // Paginate
  const startIndex = (currentPage - 1) * cardsPerPage;
  const endIndex = startIndex + cardsPerPage;
  const cardsToDisplay = filteredCards.slice(startIndex, endIndex);

  console.log(
    `Showing cards ${startIndex + 1} to ${Math.min(endIndex, filteredCards.length)} of ${filteredCards.length}`,
  );

  // Display the cards
  displayCards(cardsToDisplay, currencyFilter);

  // Update pagination
  updatePagination(filteredCards.length);
}

// Function to display cards
function displayCards(cards, currencyFilter) {
  // Determine which container to use based on the page
  let cardContainer;
  if (document.getElementById("card-display-test")) {
    cardContainer = document.getElementById("card-display-test");
  } else if (document.getElementById("cards-search-results-list")) {
    cardContainer = document.getElementById("cards-search-results-list");
  } else {
    cardContainer = document.getElementById("card-display-test");
  }

  cardContainer.innerHTML = "";

  cards.forEach((card) => {
    if (!card || !card.name || !card.images) return;

    // Create a container for each card
    const cardDiv = document.createElement("div");
    cardDiv.style.display = "inline-block";
    cardDiv.style.textAlign = "center";
    cardDiv.style.margin = "10px";
    cardDiv.style.verticalAlign = "top";

    // Create checkbox for price check
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = card.id;
    checkbox.className = "card-checkbox";
    checkbox.style.display = "block";
    checkbox.style.margin = "0 auto 5px auto";

    // Create the card image
    const cardImg = document.createElement("img");
    cardImg.src = card.images.large || card.images.small;
    cardImg.alt = card.name;
    cardImg.style.width = "200px";
    cardImg.style.display = "block";
    cardImg.style.margin = "0 auto 5px auto";
    cardImg.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.2)";
    cardImg.style.border = "2px solid #FFD700";
    cardImg.style.borderRadius = "8px";

    // Create card name
    const cardName = document.createElement("div");
    cardName.textContent = card.name;
    cardName.style.fontSize = "14px";
    cardName.style.fontWeight = "bold";
    cardName.style.marginBottom = "5px";
    cardName.style.color = "#fffafa";

    // Create pricing info
    const pricingDiv = document.createElement("div");
    pricingDiv.style.fontSize = "12px";
    pricingDiv.style.color = "#eeeeee";

    const prices = [];
    const usdPrice = extractUSDPrice(card);

    // USD Pricing
    if (currencyFilter === "usd" || currencyFilter === "both") {
      if (usdPrice > 0) {
        prices.push(`$${usdPrice.toFixed(2)} USD`);
      } else {
        prices.push("USD: N/A");
      }
    }

    // CAD Pricing (converted from USD)
    if (currencyFilter === "cad" || currencyFilter === "both") {
      if (usdPrice > 0) {
        const cadPrice = usdPrice * USD_TO_CAD_RATE;
        prices.push(`$${cadPrice.toFixed(2)} CAD`);
      } else {
        prices.push("CAD: N/A");
      }
    }

    const pricingText =
      prices.length > 0 ? "Price: " + prices.join(" | ") : "Price: N/A";

    pricingDiv.textContent = pricingText;

    // Add click event to show more details
    cardDiv.onclick = (e) => {
      // Don't trigger if clicking checkbox
      if (e.target === checkbox) return;

      console.log("Card details:", card);
      alert(
        `${card.name}\nSet: ${card.set.name}\nNumber: ${card.number}\nRarity: ${
          card.rarity || "N/A"
        }\n${pricingText}`,
      );
    };

    // Assemble the card display
    cardDiv.appendChild(checkbox);
    cardDiv.appendChild(cardImg);
    cardDiv.appendChild(cardName);
    cardDiv.appendChild(pricingDiv);

    // Add the card to the container
    cardContainer.appendChild(cardDiv);
  });
}

// Function to update pagination controls
function updatePagination(totalCount) {
  const totalPages = Math.ceil(totalCount / cardsPerPage);
  const paginationDiv = document.getElementById("pagination");
  const paginationBottom = document.getElementById("pagination-bottom");
  const pageNumbers = document.getElementById("pageNumbers");
  const prevBtnBottom = document.getElementById("prevBtnBottom");
  const nextBtnBottom = document.getElementById("nextBtnBottom");

  if (totalPages > 1) {
    paginationDiv.style.display = "block";
    paginationBottom.style.display = "block";

    // Create clickable page numbers
    pageNumbers.innerHTML = "";

    // Show max 10 page numbers at a time
    let startPage = Math.max(1, currentPage - 5);
    let endPage = Math.min(totalPages, startPage + 9);

    // Adjust if we're near the end
    if (endPage - startPage < 9) {
      startPage = Math.max(1, endPage - 9);
    }

    // Add first page and ellipsis if needed
    if (startPage > 1) {
      const firstBtn = document.createElement("button");
      firstBtn.textContent = "1";
      firstBtn.onclick = () => goToPage(1);
      firstBtn.style.margin = "0 2px";
      pageNumbers.appendChild(firstBtn);

      if (startPage > 2) {
        const ellipsis = document.createElement("span");
        ellipsis.textContent = "...";
        ellipsis.style.margin = "0 5px";
        pageNumbers.appendChild(ellipsis);
      }
    }

    // Add page number buttons
    for (let i = startPage; i <= endPage; i++) {
      const pageBtn = document.createElement("button");
      pageBtn.textContent = i;
      pageBtn.onclick = () => goToPage(i);
      pageBtn.style.margin = "0 2px";

      if (i === currentPage) {
        pageBtn.style.fontWeight = "bold";
        pageBtn.style.backgroundColor = "#2196f3";
        pageBtn.style.color = "white";
      }

      pageNumbers.appendChild(pageBtn);
    }

    // Add ellipsis and last page if needed
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        const ellipsis = document.createElement("span");
        ellipsis.textContent = "...";
        ellipsis.style.margin = "0 5px";
        pageNumbers.appendChild(ellipsis);
      }

      const lastBtn = document.createElement("button");
      lastBtn.textContent = totalPages;
      lastBtn.onclick = () => goToPage(totalPages);
      lastBtn.style.margin = "0 2px";
      pageNumbers.appendChild(lastBtn);
    }

    prevBtnBottom.disabled = currentPage === 1;
    nextBtnBottom.disabled = currentPage === totalPages;
  } else {
    paginationDiv.style.display = "none";
    paginationBottom.style.display = "none";
  }
}

// Function to change page
function changePage(direction) {
  const totalPages = Math.ceil(allCards.length / cardsPerPage);
  currentPage += direction;

  if (currentPage < 1) currentPage = 1;
  if (currentPage > totalPages) currentPage = totalPages;

  applyFilters();
}

// Function to go to specific page
function goToPage(pageNumber) {
  currentPage = pageNumber;
  applyFilters();
}

// Function to scroll to top
function scrollToTop() {
  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
}

// Function to remove selected cards (price check)
function removeSelectedCards() {
  const checkboxes = document.querySelectorAll(".card-checkbox:checked");
  const idsToCheck = Array.from(checkboxes).map((cb) => cb.value);

  if (idsToCheck.length === 0) {
    alert("No cards selected for price check.");
    return;
  }

  // Find the selected cards from allCards
  const selectedCards = allCards.filter((card) => idsToCheck.includes(card.id));

  const priceInfo = selectedCards
    .map((card) => {
      const usdPrice = extractUSDPrice(card);
      const cadPrice = usdPrice * USD_TO_CAD_RATE;

      return {
        name: card.name,
        id: card.id,
        usdPrice,
        cadPrice,
        card: card,
      };
    })
    .sort((a, b) => b.usdPrice - a.usdPrice);

  // Log to console with full details
  console.log("=== PRICE CHECK RESULTS ===");
  priceInfo.forEach((info) => {
    console.log(
      `${info.name} (${info.id}):\n` +
        `  USD: $${info.usdPrice.toFixed(2)}\n` +
        `  CAD: C$${info.cadPrice.toFixed(2)}\n` +
        `  Full Card Data:`,
      info.card,
    );
  });

  // Create summary for alert
  const summary = priceInfo
    .map(
      (info) =>
        `${info.name}\n  USD: $${info.usdPrice.toFixed(2)} | CAD: C$${info.cadPrice.toFixed(2)}`,
    )
    .join("\n\n");

  alert(
    `PRICE CHECK (${idsToCheck.length} cards)\n\n${summary}\n\n✓ Check console for full card details`,
  );
}

// Function to load default cards on page load
async function loadDefaultCards() {
  // Leave search empty to show broader results
  document.getElementById("pokemonCard").value = "";
  await searchCards();
}

// Load default cards when the page loads
window.addEventListener("load", async () => {
  await loadSetsData();
  loadDefaultCards();
});

// Function to populate the set filter drawer
function populateSetFilter() {
  // Create drawer if it doesn't exist
  let drawer = document.getElementById("setDrawer");
  if (!drawer) {
    // Create overlay
    const overlay = document.createElement("div");
    overlay.id = "drawerOverlay";
    overlay.onclick = closeDrawer;
    document.body.appendChild(overlay);

    // Create drawer
    drawer = document.createElement("div");
    drawer.id = "setDrawer";
    drawer.className = "drawer";
    document.body.appendChild(drawer);
  }

  drawer.innerHTML = "";

  // Create drawer header
  const header = document.createElement("div");
  header.className = "drawer-header";

  const title = document.createElement("h2");
  title.textContent = "Filter by Sets";

  const closeBtn = document.createElement("button");
  closeBtn.className = "drawer-close-btn";
  closeBtn.textContent = "✕";
  closeBtn.onclick = closeDrawer;

  header.appendChild(title);
  header.appendChild(closeBtn);
  drawer.appendChild(header);

  // Create drawer content
  const content = document.createElement("div");
  content.className = "drawer-content";

  console.log("Populating drawer with expansion-grouped sets");

  const sets = window.allSetsData || [];

  if (sets.length === 0) {
    content.innerHTML = '<p class="no-sets-message">No sets available</p>';
    drawer.appendChild(content);
    return;
  }

  // Group sets by series
  const groupedSets = {};
  sets.forEach((set) => {
    const series = set.series || "Other";
    if (!groupedSets[series]) {
      groupedSets[series] = [];
    }
    groupedSets[series].push(set);
  });

  // Sort series by newest release date (newest expansion first)
  const sortedSeries = Object.keys(groupedSets).sort((a, b) => {
    // Get the newest set from each series
    const newestA = groupedSets[a].reduce((newest, set) => {
      const dateA = new Date(set.releaseDate || 0);
      const dateNewest = new Date(newest.releaseDate || 0);
      return dateA > dateNewest ? set : newest;
    });
    const newestB = groupedSets[b].reduce((newest, set) => {
      const dateB = new Date(set.releaseDate || 0);
      const dateNewest = new Date(newest.releaseDate || 0);
      return dateB > dateNewest ? set : newest;
    });

    // Compare newest dates - newest first (descending)
    const dateA = new Date(newestA.releaseDate || 0);
    const dateB = new Date(newestB.releaseDate || 0);
    return dateB - dateA;
  });

  // Add Check All / Clear All buttons
  const buttonsDiv = document.createElement("div");
  buttonsDiv.className = "drawer-action-buttons";

  const checkAllBtn = document.createElement("button");
  checkAllBtn.textContent = "Check All";
  checkAllBtn.className = "drawer-btn";
  checkAllBtn.onclick = () => {
    const checkboxes = drawer.querySelectorAll(".set-checkbox");
    checkboxes.forEach((cb) => (cb.checked = true));
  };

  const clearAllBtn = document.createElement("button");
  clearAllBtn.textContent = "Clear All";
  clearAllBtn.className = "drawer-btn";
  clearAllBtn.onclick = () => {
    const checkboxes = drawer.querySelectorAll(".set-checkbox");
    checkboxes.forEach((cb) => (cb.checked = false));
  };

  buttonsDiv.appendChild(checkAllBtn);
  buttonsDiv.appendChild(clearAllBtn);
  content.appendChild(buttonsDiv);

  // Create expansion groups
  sortedSeries.forEach((series) => {
    const expansionDiv = document.createElement("div");
    expansionDiv.className = "expansion-group";

    // Expansion header (clickable)
    const expansionHeader = document.createElement("div");
    expansionHeader.className = "expansion-header";
    expansionHeader.onclick = () =>
      toggleExpansion(series.replace(/\s+/g, "-"));

    const arrow = document.createElement("span");
    arrow.className = "expansion-arrow";
    arrow.id = `arrow-${series.replace(/\s+/g, "-")}`;
    arrow.textContent = "▶";

    const seriesName = document.createElement("span");
    seriesName.className = "expansion-name";
    seriesName.textContent = series;

    const setCount = document.createElement("span");
    setCount.className = "expansion-count";
    setCount.textContent = `(${groupedSets[series].length})`;

    expansionHeader.appendChild(arrow);
    expansionHeader.appendChild(seriesName);
    expansionHeader.appendChild(setCount);

    // Sets container (initially hidden)
    const setsContainer = document.createElement("div");
    setsContainer.className = "expansion-sets";
    setsContainer.id = `series-${series.replace(/\s+/g, "-")}`;
    setsContainer.style.display = "none";

    // Sort sets by release date (newest first)
    groupedSets[series].sort((a, b) => {
      const dateA = new Date(a.releaseDate || 0);
      const dateB = new Date(b.releaseDate || 0);
      return dateB - dateA;
    });

    // Add checkboxes for each set
    groupedSets[series].forEach((set) => {
      const label = document.createElement("label");
      label.className = "set-label";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = set.id;
      checkbox.className = "set-checkbox";

      const setName = document.createElement("span");
      setName.textContent = set.name;

      label.appendChild(checkbox);
      label.appendChild(setName);
      setsContainer.appendChild(label);
    });

    expansionDiv.appendChild(expansionHeader);
    expansionDiv.appendChild(setsContainer);
    content.appendChild(expansionDiv);
  });

  drawer.appendChild(content);

  // Create drawer footer with apply button
  const footer = document.createElement("div");
  footer.className = "drawer-footer";

  const applyBtn = document.createElement("button");
  applyBtn.textContent = "Apply Filter";
  applyBtn.className = "apply-filter-btn";
  applyBtn.onclick = () => {
    applySetFilter();
    closeDrawer();
  };

  footer.appendChild(applyBtn);
  drawer.appendChild(footer);

  console.log(`Created drawer with ${sortedSeries.length} expansion groups`);
}

// Function to apply set filter
function applySetFilter() {
  const checkboxes = document.querySelectorAll(".set-checkbox:checked");
  window.selectedSets = Array.from(checkboxes).map((cb) => cb.value);
  console.log("Applied set filter:", window.selectedSets);
  currentPage = 1; // Reset to first page

  // Set sort order to high-to-low when filtering by sets
  const sortOrderSelect = document.getElementById("sortOrder");
  if (sortOrderSelect && window.selectedSets.length > 0) {
    sortOrderSelect.value = "high-to-low";
  }

  searchCards(); // Re-search to fetch cards from selected sets
}

// Function to update cards per page
function updateCardsPerPage() {
  const select = document.getElementById("cardsPerPage");
  cardsPerPage = parseInt(select.value);
  currentPage = 1; // Reset to first page
  applyFilters();
}

// Function to toggle drawer visibility
function toggleDropdown() {
  const drawer = document.getElementById("setDrawer");
  const overlay = document.getElementById("drawerOverlay");
  drawer.classList.toggle("open");
  overlay.classList.toggle("show");
}

// Function to close drawer
function closeDrawer() {
  const drawer = document.getElementById("setDrawer");
  const overlay = document.getElementById("drawerOverlay");
  drawer.classList.remove("open");
  overlay.classList.remove("show");
}

// Function to toggle expansion group
function toggleExpansion(seriesName) {
  const setsContainer = document.getElementById(`series-${seriesName}`);
  const arrow = document.getElementById(`arrow-${seriesName}`);

  if (
    setsContainer.style.display === "none" ||
    setsContainer.style.display === ""
  ) {
    // Count the number of sets to calculate rows needed
    const numberOfSets = setsContainer.children.length;
    const numberOfRows = Math.ceil(numberOfSets / 3);

    setsContainer.style.display = "grid";
    setsContainer.style.gridTemplateColumns = "repeat(3, 1fr)";
    setsContainer.style.gridTemplateRows = `repeat(${numberOfRows}, auto)`;
    setsContainer.style.gridAutoFlow = "column";
    setsContainer.style.gap = "6px";
    arrow.textContent = "▼";
  } else {
    setsContainer.style.display = "none";
    arrow.textContent = "▶";
  }
}

// Function to load sets data
async function loadSetsData() {
  try {
    console.log("Loading sets from Pokemon TCG API...");
    const response = await fetch(`${POKEMON_TCG_API_BASE}/sets`, {
      headers: {
        "X-Api-Key": POKEMON_TCG_API_KEY,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to load sets: ${response.status}`);
    }

    const data = await response.json();
    const sets = data.data || [];

    // Store both the map and full set data
    setsMap = {};
    window.allSetsData = sets; // Store full set objects for grouping
    sets.forEach((set) => {
      setsMap[set.id] = set.name;
    });

    console.log(`Loaded ${sets.length} sets from Pokemon TCG API`);

    // Populate set filter with all available sets
    populateSetFilter();
  } catch (error) {
    console.error("Error loading sets data:", error);
  }
}

// Load default cards when the page loads
window.addEventListener("load", async () => {
  await loadSetsData();
  loadDefaultCards();

  // Add Enter key listener to search input
  const searchInput = document.getElementById("pokemonCard");
  if (searchInput) {
    searchInput.addEventListener("keypress", (event) => {
      if (event.key === "Enter") {
        searchCards();
      }
    });
  }
});



// Make the functions globally available (since onclick uses them)
window.searchCards = searchCards;
window.applyFilters = applyFilters;
window.changePage = changePage;
window.goToPage = goToPage;
window.scrollToTop = scrollToTop;
window.removeSelectedCards = removeSelectedCards;
window.toggleDropdown = toggleDropdown;
window.closeDrawer = closeDrawer;
window.toggleExpansion = toggleExpansion;
window.applySetFilter = applySetFilter;
window.updateCardsPerPage = updateCardsPerPage;
