let RAPIDAPI_KEY = "";
let RAPIDAPI_HOST = "pokemon-tcg-api.p.rapidapi.com";

// Load config from server
async function loadApiConfig() {
  try {
    const response = await fetch("/api/config");
    const config = await response.json();
    RAPIDAPI_KEY = config.rapidApiKey;
    RAPIDAPI_HOST = config.rapidApiHost;
  } catch (error) {
    console.error("Failed to load API config:", error);
  }
}

const options = {
  get method() {
    return "GET";
  },
  get headers() {
    return {
      "x-rapidapi-key": RAPIDAPI_KEY,
      "x-rapidapi-host": RAPIDAPI_HOST,
    };
  },
};

let BASE_URL = `https://pokemon-tcg-api.p.rapidapi.com/cards`;
const cardArray = [];

const searchTerms = {
  page: 0,
  search: "",
  artist_id: "",
  episode_id: 0,
  name: "",
  tcgid: "",
  cardmarket_id: 0,
  card_number: "",
  sort: "relevance",
};

const searchForCards = async (maxPages = 6) => {
  const allCards = [];
  const seenIds = new Set(); // Track unique card IDs
  let currentPage = 0;

  console.log(`🔍 Starting search with maxPages: ${maxPages}`);

  while (currentPage < maxPages) {
    searchTerms.page = currentPage;
    let url = `${BASE_URL}/search?`;

    Object.entries(searchTerms).forEach(([key, val]) => {
      if (val !== "" && val !== 0) {
        url += `${key}=${val}&`;
      }
    });
    url = url.slice(0, -1);
    console.log(`📄 Fetching page ${currentPage}: ${url}`);

    try {
      const response = await fetch(`${url}`, options);
      const result = await response.json();

      console.log(`✅ Page ${currentPage} result:`, {
        dataLength: result.data?.length || 0,
        paging: result.paging,
        totalPages: result.paging?.total,
      });

      if (result.data && result.data.length > 0) {
        // Filter out duplicates
        const uniqueCards = result.data.filter((card) => {
          if (seenIds.has(card.id)) {
            return false;
          }
          seenIds.add(card.id);
          return true;
        });

        allCards.push(...uniqueCards);
        console.log(
          `📊 Total unique cards collected so far: ${allCards.length}`,
        );

        if (!result.paging || currentPage >= result.paging.total - 1) {
          console.log(`🛑 Stopping: No more pages available`);
          break;
        }
      } else {
        console.log(`🛑 Stopping: No data returned`);
        break;
      }
      currentPage++;
    } catch (err) {
      console.error(`❌ Error on page ${currentPage}:`, err);
      break;
    }
  }

  console.log(
    `🎯 Final result: ${allCards.length} unique cards from ${currentPage} pages`,
  );
  return { data: allCards };
};

const listCardsByExpansion = async (episodeId, maxPages = 20) => {
  const allCards = [];
  const seenIds = new Set();
  let currentPage = 0;

  console.log(`🔍 Fetching expansion ${episodeId} with maxPages: ${maxPages}`);

  while (currentPage < maxPages) {
    let url = `${BASE_URL}/search?`;

    const terms = { ...searchTerms, episode_id: episodeId, page: currentPage };

    Object.entries(terms).forEach(([key, val]) => {
      if (val !== "" && val !== 0) {
        url += `${key}=${val}&`;
      }
    });
    url = url.slice(0, -1);
    console.log(`📄 Fetching page ${currentPage}: ${url}`);

    try {
      const response = await fetch(`${url}`, options);
      const result = await response.json();

      console.log(`✅ Page ${currentPage} result:`, {
        dataLength: result.data?.length || 0,
        paging: result.paging,
        totalPages: result.paging?.total,
        firstCardId: result.data?.[0]?.id,
        lastCardId: result.data?.[result.data?.length - 1]?.id,
      });

      if (result.data && result.data.length > 0) {
        const beforeFilter = result.data.length;
        const uniqueCards = result.data.filter((card) => {
          if (seenIds.has(card.id)) {
            console.log(`⚠️ Duplicate found: ${card.name} (${card.id})`);
            return false;
          }
          seenIds.add(card.id);
          return true;
        });

        console.log(
          `🔢 Page ${currentPage}: ${beforeFilter} cards received, ${uniqueCards.length} unique, ${beforeFilter - uniqueCards.length} duplicates filtered`,
        );

        allCards.push(...uniqueCards);
        console.log(`📊 Total unique cards: ${allCards.length}`);

        // Only stop if no paging info OR we've gone past total pages
        if (result.paging && currentPage < result.paging.total - 1) {
          currentPage++;
        } else if (result.paging && currentPage >= result.paging.total - 1) {
          console.log(
            `🛑 Reached last page according to API (${currentPage}/${result.paging.total - 1})`,
          );
          // Try one more page to be sure
          currentPage++;
          const testUrl = `${BASE_URL}/search?episode_id=${episodeId}&page=${currentPage}&sort=relevance`;
          const testResponse = await fetch(testUrl, options);
          const testResult = await testResponse.json();

          if (testResult.data && testResult.data.length > 0) {
            console.log(
              `🎁 Found ${testResult.data.length} more cards on page ${currentPage}!`,
            );
            const moreUniqueCards = testResult.data.filter((card) => {
              if (!seenIds.has(card.id)) {
                seenIds.add(card.id);
                return true;
              }
              return false;
            });
            allCards.push(...moreUniqueCards);
            console.log(`📊 Total unique cards now: ${allCards.length}`);
          }
          break;
        } else {
          currentPage++;
        }
      } else {
        console.log(`🛑 No data returned on page ${currentPage}`);
        break;
      }
    } catch (err) {
      console.error(`❌ Error on page ${currentPage}:`, err);
      break;
    }
  }

  console.log(
    `🎯 FINAL: ${allCards.length} unique cards from pages fetched for expansion ${episodeId}`,
  );
  return { data: allCards };
};

// Test find expansion by name

const findExpansionByName = async (expansionName, maxPages = 10) => {
  const expansionUrl = `https://pokemon-tcg-api.p.rapidapi.com/episodes/search?search=${expansionName}`;

  try {
    const response = await fetch(`${expansionUrl}`, options);
    const result = await response.json();

    if (result.data && result.data.length > 0) {
      return result.data[0];
    }
    return null;
  } catch (err) {
    console.error(err);
    return null;
  }
};

const searchExpansionCards = async (expansionName) => {
  const expansion = await findExpansionByName(expansionName);

  if (expansion) {
    console.log(`Found: ${expansion.name} (ID: ${expansion.id})`);
    const cards = await listCardsByExpansion(expansion.id);
    return cards;
  } else {
    console.log(`Set not found.`);
    return null;
  }
};

// test inputs for html

let EUR_TO_USD = 1.09;
let currentCurrency = "USD"; // or 'EUR'

const fetchExchangeRate = async () => {
  try {
    const response = await fetch(
      "https://api.exchangerate-api.com/v4/latest/EUR",
    );
    const data = await response.json();
    EUR_TO_USD = data.rates.USD;
    console.log(`Exchange rate: 1 EUR = ${EUR_TO_USD} USD`);
  } catch (error) {
    console.error("Failed to fetch exchange rate:", error);
  }
};

document.addEventListener("DOMContentLoaded", async () => {
  await loadApiConfig(); // Load config FIRST

  fetchExchangeRate();
  initializeDrawer();

  const searchInput = document.getElementById("card-search-input");
  const searchButton = document.getElementById("card-search-button");
  const cardDisplay = document.getElementById("card-display-tests");
  const sortSelect = document.getElementById("sort-select");

  // ✅ Add safety check
  if (!searchInput || !searchButton || !cardDisplay) {
    console.error("Required HTML elements not found:", {
      searchInput: !!searchInput,
      searchButton: !!searchButton,
      cardDisplay: !!cardDisplay,
    });
    return; // Stop execution if elements missing
  }

  window.currentCards = [];

  if (sortSelect) {
    sortSelect.addEventListener("change", () => {
      if (window.currentCards.length > 0) {
        const sortedCards = sortCards(window.currentCards, sortSelect.value);
        displayCards(sortedCards);
      }
    });
  }

  searchButton.addEventListener("click", async () => {
    const searchTerm = searchInput.value.trim();
    if (!searchTerm) {
      alert(`Please enter a search term.`);
      return;
    }

    console.log(`Searching for ${searchTerm}...`);

    //loading state
    const loader = document.getElementById("pokeball-loader");
    searchButton.disabled = true;
    searchButton.textContent = "Searching...";
    if (loader) loader.classList.add("active");
    cardDisplay.innerHTML = "";

    try {
      //update searchTerms with user input
      searchTerms.name = searchTerm;
      searchTerms.page = 0; //reset to first page

      const result = await searchForCards(10);

      if (result && result.data && result.data.length > 0) {
        console.log(`Found ${result.data.length} cards.`);
        window.currentCards = result.data;

        const sortedCards = sortSelect
          ? sortCards(window.currentCards, sortSelect.value)
          : window.currentCards;
        displayCards(sortedCards);
      } else {
        cardDisplay.innerHTML = "<p>No cards found.</p>";
        window.currentCards = [];
      }
    } catch (error) {
      console.error(`Error searching for cards:`, error);
      cardDisplay.innerHTML =
        "<p>Error searching for cards please try again.</p>";
      window.currentCards = [];
    } finally {
      //reset button state
      searchButton.disabled = false;
      searchButton.textContent = "Search Cards";
      if (loader) loader.classList.remove("active");
      searchTerms.name = "";
    }
  });

  searchInput.addEventListener(`keypress`, (event) => {
    if (event.key === `Enter`) {
      searchButton.click();
    }
  });
});

const buildGradedPricesHTML = (gradedPrices, exchangeRate) => {
  if (!gradedPrices) return "";

  let html = '<div class="graded-prices"><strong>Graded Prices:</strong><br>';

  // PSA Grades
  if (gradedPrices.psa) {
    html += '<div class="grading-company-section">';
    html += '<span class="grading-company">PSA:</span> ';
    Object.entries(gradedPrices.psa).forEach(([grade, price]) => {
      const gradeNum = grade.replace("psa", "");
      html += `<span class="grade-price">${gradeNum}: $${(price * exchangeRate).toFixed(2)}</span> `;
    });
    html += "</div>";
  }

  // BGS Grades
  if (gradedPrices.bgs) {
    html += '<div class="grading-company-section">';
    html += '<span class="grading-company">BGS:</span> ';
    Object.entries(gradedPrices.bgs).forEach(([grade, price]) => {
      const gradeDisplay = grade.includes("pristine")
        ? "10 Pristine"
        : grade.replace("bgs", "");
      html += `<span class="grade-price">${gradeDisplay}: $${(price * exchangeRate).toFixed(2)}</span> `;
    });
    html += "</div>";
  }

  html += "</div>";
  return html;
};

// ✅ Define this function BEFORE displayCards
function attachWishlistHandlers() {
  const buttons = document.querySelectorAll(
    "[data-wishlist-btn]:not(.in-wishlist)",
  );
  console.log(`Found ${buttons.length} wishlist buttons to attach`);

  buttons.forEach((btn) => {
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);

    newBtn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();

      const cardId = String(this.dataset.cardId);
      console.log("Button clicked for card:", cardId);

      if (typeof wishlistManager === "undefined") {
        console.error("wishlistManager is not defined!");
        alert("Wishlist feature is not available. Please refresh the page.");
        return;
      }

      const card = window.currentDisplayedCards?.find((c) => {
        const id = c.id ?? c.card_id ?? c.cardId;
        return String(id) === cardId;
      });

      if (!card) {
        console.error("Card not found:", cardId);
        return;
      }

      console.log("Card found:", card);

      // ✅ Map card data
      const wishlistCard = {
        id: card.id,
        name: card.name,
        images: {
          small: card.image,
          large: card.image,
        },
        set: {
          name: card.episode?.name || "Unknown Set",
          id: card.episode?.id || "",
        },
        number: card.card_number,
        rarity: card.rarity || "Unknown",
        types: card.types || [],
        supertype: card.supertype || "Pokémon",
        tcgplayer: {
          prices: {
            normal: {
              market:
                parseFloat(
                  card.prices?.tcg_player?.market_price * EUR_TO_USD,
                ) || 0,
            },
          },
        },
        cardmarket: {
          prices: {
            averageSellPrice:
              parseFloat(
                card.prices?.cardmarket?.lowest_near_mint * EUR_TO_USD,
              ) || 0,
          },
        },
        gradedPrices: {
          psa9:
            parseFloat(
              (card.prices?.cardmarket?.graded?.psa?.psa9 ||
                card.prices?.cardmarket?.graded?.["PSA 9"]) * EUR_TO_USD,
            ) || 0,
          psa10:
            parseFloat(
              (card.prices?.cardmarket?.graded?.psa?.psa10 ||
                card.prices?.cardmarket?.graded?.["PSA 10"]) * EUR_TO_USD,
            ) || 0,
          beckett9:
            parseFloat(
              (card.prices?.cardmarket?.graded?.bgs?.bgs9 ||
                card.prices?.cardmarket?.graded?.["BGS 9"]) * EUR_TO_USD,
            ) || 0,
          beckett10:
            parseFloat(
              (card.prices?.cardmarket?.graded?.bgs?.bgs10 ||
                card.prices?.cardmarket?.graded?.["BGS 10"] ||
                card.prices?.cardmarket?.graded?.bgs?.bgs10pristine) *
                EUR_TO_USD,
            ) || 0,
        },
      };

      console.log("Mapped card for wishlist:", wishlistCard);

      const success = wishlistManager.addCard(wishlistCard);

      if (success) {
        this.textContent = "✓ In Wishlist";
        this.classList.add("in-wishlist");
        this.disabled = true;
      }
    });
  });
}

const displayCards = (cards) => {
  const cardDisplay = document.getElementById("card-display-tests");

  if (!cardDisplay) {
    console.error("Card display element not found.");
    return;
  }
  cardDisplay.innerHTML = "";

  // ✅ Store reference to cards globally for wishlist functionality
  window.currentDisplayedCards = cards;

  cards.forEach((card) => {
    const cardDiv = document.createElement("div");
    cardDiv.className = "card-item";

    // Raw prices
    const cardmarketPriceEUR = card.prices?.cardmarket?.lowest_near_mint;
    const tcgPlayerPriceEUR = card.prices?.tcg_player?.market_price;

    // Convert to USD
    const cardmarketPriceUSD = cardmarketPriceEUR
      ? (cardmarketPriceEUR * EUR_TO_USD).toFixed(2)
      : null;
    const tcgPlayerPriceUSD = tcgPlayerPriceEUR
      ? (tcgPlayerPriceEUR * EUR_TO_USD).toFixed(2)
      : null;

    // Get graded prices HTML
    const gradedHTML = buildGradedPricesHTML(
      card.prices?.cardmarket?.graded,
      EUR_TO_USD,
    );

    // ✅ Check if card is in wishlist
    const inWishlist =
      typeof wishlistManager !== "undefined" &&
      wishlistManager.isInWishlist(card.id);

    cardDiv.innerHTML = `
        <img src="${card.image}" alt="${card.name}" loading="lazy" />
        <h3>${card.name}</h3>
        <p class="card-set">${card.episode?.name || "Unknown"}</p>
        <p class="card-number">Card #${card.card_number}</p>
        <p class="card-rarity">Rarity: ${card.rarity || "N/A"}</p>
        <div class="card-pricing">
          <p class="card-price">
            <strong>Raw Prices:</strong><br>
            Cardmarket: $${cardmarketPriceUSD || "N/A"}<br>
            TCGPlayer: $${tcgPlayerPriceUSD || "N/A"}
          </p>
          ${gradedHTML}
        </div>
        <button 
          class="btn-wishlist ${inWishlist ? "in-wishlist" : ""}" 
          data-wishlist-btn
          data-card-id="${card.id ?? card.card_id ?? card.cardId}"
          ${inWishlist ? "disabled" : ""}>
          ${inWishlist ? "✓ In Wishlist" : "+ Add to Wishlist"}
        </button>
        `;

    cardDisplay.appendChild(cardDiv);
  });

  // ✅ Add click handlers after DOM is updated
  setTimeout(() => {
    attachWishlistHandlers();
  }, 100);
};

document
  .querySelectorAll("[data-wishlist-btn]:not(.in-wishlist)")
  .forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const cardId = e.target.dataset.cardId;
      const card = cards.find((c) => c.id === cardId);

      if (card && wishlistManager) {
        console.log("Adding card to wishlist:", card); // Debug log

        // ✅ Map your API card format to the format wishlist expects
        const wishlistCard = {
          id: card.id,
          name: card.name,
          images: {
            small: card.image,
            large: card.image,
          },
          set: {
            name: card.episode?.name || "Unknown Set",
            id: card.episode?.id || "",
          },
          number: card.card_number,
          rarity: card.rarity || "Unknown",
          types: card.types || [],
          supertype: card.supertype || "Pokémon",
          tcgplayer: {
            prices: {
              normal: {
                market: parseFloat(tcgPlayerPriceUSD) || 0,
              },
            },
          },
          cardmarket: {
            prices: {
              averageSellPrice: parseFloat(cardmarketPriceUSD) || 0,
            },
          },
        };

        const success = wishlistManager.addCard(wishlistCard);

        if (success) {
          // Update button state immediately
          e.target.textContent = "✓ In Wishlist";
          e.target.classList.add("in-wishlist");
          e.target.disabled = true;
        }
      } else if (typeof wishlistManager === "undefined") {
        console.error("WishListManager is not defined.");
        alert(
          "Wishlist feature is not available. Please refresh the page or try again later.",
        );
      }
    });
  });

const getAllExpansions = async () => {
  let allExpansions = [];
  let page = 0;
  let hasMorePages = true;
  const seenIds = new Set();

  try {
    while (hasMorePages) {
      const url = `https://pokemon-tcg-api.p.rapidapi.com/episodes?page=${page}`;
      const response = await fetch(url, options);
      const result = await response.json();

      if (result.data && result.data.length > 0) {
        const uniqueExpansions = result.data.filter((exp) => {
          if (seenIds.has(exp.id)) {
            return false;
          }
          seenIds.add(exp.id);
          return true;
        });

        allExpansions.push(...uniqueExpansions);

        if (result.paging) {
          hasMorePages = page < result.paging.total - 1;
        } else {
          hasMorePages = false;
        }
      } else {
        hasMorePages = false;
      }

      page++;

      if (page > 50) {
        console.warn("Reached page limit, stopping");
        break;
      }
    }

    return allExpansions;
  } catch (err) {
    console.error(`❌ Error fetching expansions:`, err);
    return allExpansions;
  }
};

const groupExpansionsBySeries = (expansions) => {
  const sorted = expansions.sort(
    (a, b) => new Date(b.released_at) - new Date(a.released_at),
  );

  const grouped = {};
  const seenNames = {};

  sorted.forEach((expansion) => {
    const seriesName = expansion.series?.name || "Other";
    const expandedKey = `${expansion.name}-${expansion.code}`;

    if (seenNames[expandedKey]) {
      return; // Skip duplicates silently
    }

    seenNames[expandedKey] = true;

    if (!grouped[seriesName]) {
      grouped[seriesName] = [];
    }
    grouped[seriesName].push(expansion);
  });

  return grouped;
};

const buildDrawerContent = (groupExpansions) => {
  let html = "";

  Object.entries(groupExpansions).forEach(([seriesName, expansions]) => {
    const seriesId = seriesName.replace(/\s+/g, "-");

    const sortedExpansions = [...expansions].sort((a, b) => {
      const dateA = new Date(a.released_at || "1996-01-01");
      const dateB = new Date(b.released_at || "1996-01-01");
      return dateB - dateA;
    });

    html += `
        <div class="expansion-group">
          <div class="expansion-header" data-series-id="${seriesId}">
           <span class="expansion-arrow">▶</span>
           <span class="expansion-name">${seriesName}</span>
           <span class="expansion-count">(${sortedExpansions.length} sets)</span>
           </div>
           <div class="expansion-sets" data-series-id="${seriesId}">
         `;

    sortedExpansions.forEach((exp) => {
      html += `
            <label class="set-label">
              <input type="checkbox" class="set-checkbox" value="${exp.id}" />
              <span class="set-name">${exp.name}</span>
              <span class="set-date">${exp.released_at ? `(${exp.released_at})` : ""}</span>
            </label>
            `;
    });
    html += `</div>
         </div>
         `;
  });
  return html;
};

window.toggleExpansion = (seriesId) => {
  const setsContainer = document.querySelector(
    `.expansion-sets[data-series-id="${seriesId}"]`,
  );
  const header = document.querySelector(
    `.expansion-header[data-series-id="${seriesId}"]`,
  );
  const arrow = header?.querySelector(".expansion-arrow");

  if (setsContainer && arrow) {
    const isOpen = setsContainer.classList.contains("open");

    if (isOpen) {
      setsContainer.classList.remove("open");
      arrow.textContent = "▶";
    } else {
      const itemCount = setsContainer.querySelectorAll(".set-label").length;
      const rowsNeeded = Math.ceil(itemCount / 3);

      setsContainer.style.gridTemplateRows = `repeat(${rowsNeeded}, auto)`;

      setsContainer.classList.add("open");
      arrow.textContent = "▼";
    }
  }
};

const sortCards = (cards, sortType) => {
  const sortedCards = [...cards];

  switch (sortType) {
    case "price-high":
      return sortedCards.sort((a, b) => {
        const priceA = Math.max(
          a.prices?.cardmarket?.lowest_near_mint || 0,
          a.prices?.tcg_player?.market_price || 0,
        );
        const priceB = Math.max(
          b.prices?.cardmarket?.lowest_near_mint || 0,
          b.prices?.tcg_player?.market_price || 0,
        );
        return priceB - priceA;
      });

    case "card-number-high":
      return sortedCards.sort((a, b) => {
        const numA = parseInt(a.card_number) || 0;
        const numB = parseInt(b.card_number) || 0;
        return numB - numA;
      });

    default:
      return sortedCards;
  }
};

// drawer functionality
const initializeDrawer = async () => {
  const drawerOverlay = document.getElementById("drawer-overlay");
  const filterDrawer = document.getElementById("filter-drawer");
  const openFilterBtn = document.getElementById("open-filter-btn");
  const drawerCloseBtn = document.getElementById("drawer-close-btn");
  const drawerContent = document.getElementById("drawer-content");
  const applyFilterBtn = document.getElementById("apply-filter-btn");
  const clearFilterBtn = document.getElementById("clear-filter-btn");
  const sortSelect = document.getElementById("sort-select");

  if (!drawerOverlay || !filterDrawer || !openFilterBtn) {
    console.error("Drawer elements not found.");
    return;
  }

  openFilterBtn.addEventListener("click", async () => {
    drawerOverlay.classList.add("show");
    filterDrawer.classList.add("open");

    if (!drawerContent.dataset.loaded) {
      if (!RAPIDAPI_KEY) {
        await loadApiConfig();
      }

      const loader = document.getElementById("pokeball-loader");
      if (loader) loader.classList.add("active");
      drawerContent.innerHTML = "";

      const expansions = await getAllExpansions();
      const grouped = groupExpansionsBySeries(expansions);
      drawerContent.innerHTML = buildDrawerContent(grouped);
      drawerContent.dataset.loaded = "true";
      if (loader) loader.classList.remove("active");

      document.addEventListener("click", (e) => {
        const header = e.target.closest(".expansion-header");
        if (header) {
          const seriesId = header.dataset.seriesId;
          if (seriesId) {
            toggleExpansion(seriesId);
          }
        }
      });
    }
  });

  const closeDrawer = () => {
    drawerOverlay.classList.remove("show");
    filterDrawer.classList.remove("open");
  };

  drawerCloseBtn.addEventListener("click", closeDrawer);
  drawerOverlay.addEventListener("click", closeDrawer);

  applyFilterBtn.addEventListener("click", async () => {
    const selectedSets = Array.from(
      document.querySelectorAll(".set-checkbox:checked"),
    );

    if (selectedSets.length === 0) {
      alert("Please select at least one set to filter.");
      return;
    }

    const cardDisplay = document.getElementById("card-display-tests");
    const loader = document.getElementById("pokeball-loader");
    applyFilterBtn.disabled = true;
    applyFilterBtn.textContent = "Loading...";
    if (loader) loader.classList.add("active");
    cardDisplay.innerHTML = "";

    const allCards = [];

    for (const checkbox of selectedSets) {
      const episodeId = checkbox.value;
      const result = await listCardsByExpansion(episodeId);

      if (result && result.data) {
        allCards.push(...result.data);
      }
    }

    if (loader) loader.classList.remove("active");

    if (allCards.length > 0) {
      window.currentCards = allCards;

      const sortedCards = sortSelect
        ? sortCards(allCards, sortSelect.value)
        : allCards;
      displayCards(sortedCards);
      closeDrawer();
    } else {
      cardDisplay.innerHTML = "<p>No cards found for the selected sets.</p>";
      window.currentCards = [];
    }

    applyFilterBtn.disabled = false;
    applyFilterBtn.textContent = "Apply Filters";
  });

  clearFilterBtn.addEventListener("click", () => {
    document.querySelectorAll(".set-checkbox").forEach((checkbox) => {
      checkbox.checked = false;
    });
  });
};

// debugging
