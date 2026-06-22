document.addEventListener('DOMContentLoaded', () => {
    // Detect if we are running from file:// protocol, if so point to localhost, otherwise use relative path
    const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:3000/api' : '/api';
    
    // DOM Elements
    const productsGrid = document.getElementById('products-grid');
    const categoryFilter = document.getElementById('category-filter');
    const loadMoreBtn = document.getElementById('load-more');
    const loadingSpinner = document.getElementById('loading-spinner');
    const resultsCount = document.getElementById('results-count');
    const simulateInsertBtn = document.getElementById('simulate-insert-btn');

    // State
    let currentCursor = null;
    let currentCategory = '';
    let isLoading = false;
    let totalLoaded = 0;
    
    // In-memory cache for instant category switching and instant load-more
    const categoryCache = {};
    const nextPageCache = {};

    // Format Date Helper
    function formatDate(dateString) {
        const options = { 
            month: 'short', day: 'numeric', 
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        };
        return new Date(dateString).toLocaleDateString(undefined, options);
    }

    // Create Product Card HTML
    function createProductCard(product) {
        return `
            <div class="product-card">
                <div class="product-meta">
                    <span class="product-category">${product.category}</span>
                    <span class="product-date">${formatDate(product.created_at)}</span>
                </div>
                <h3 class="product-name">${product.name}</h3>
                <div class="product-price">$${product.price.toFixed(2)}</div>
                <div class="product-id">ID: ${product.id.split('-')[0]}...</div>
            </div>
        `;
    }

    // Fetch Categories and Prefetch their first pages
    async function fetchCategories() {
        try {
            const response = await fetch(`${API_BASE}/categories`);
            const categories = await response.json();
            
            categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category;
                option.textContent = category;
                categoryFilter.appendChild(option);
            });

            // Prefetch the first page of each category in the background!
            categories.forEach(category => {
                fetch(`${API_BASE}/products?limit=20&category=${category}`)
                    .then(res => res.json())
                    .then(data => { categoryCache[category] = data; })
                    .catch(() => {}); // silently ignore prefetch errors
            });

        } catch (error) {
            console.error('Failed to fetch categories', error);
        }
    }

    function renderData(data, reset) {
        if (reset) {
            productsGrid.innerHTML = '';
            totalLoaded = 0;
        }

        if (data.data.length === 0 && reset) {
            productsGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 3rem;">No products found in this category.</div>';
            resultsCount.textContent = '0 products';
        } else {
            const html = data.data.map(p => createProductCard(p)).join('');
            productsGrid.insertAdjacentHTML('beforeend', html);
            
            totalLoaded += data.data.length;
            resultsCount.textContent = `Showing ${totalLoaded} products`;
        }

        currentCursor = data.next_cursor;
        
        // Background prefetch for instant "Load More"
        if (currentCursor && !nextPageCache[currentCursor]) {
            const params = new URLSearchParams({ limit: 20, cursor: currentCursor });
            if (currentCategory) params.append('category', currentCategory);
            
            fetch(`${API_BASE}/products?${params.toString()}`)
                .then(res => res.json())
                .then(nextData => { nextPageCache[currentCursor] = nextData; })
                .catch(() => {});
        }

        if (data.has_more) {
            loadMoreBtn.style.display = 'flex';
        } else {
            loadMoreBtn.style.display = 'none';
            if (totalLoaded > 0) {
                const endMsg = document.createElement('div');
                endMsg.style.gridColumn = '1/-1';
                endMsg.style.textAlign = 'center';
                endMsg.style.color = 'var(--text-muted)';
                endMsg.style.padding = '2rem';
                endMsg.textContent = "You've reached the end of the catalog.";
                productsGrid.appendChild(endMsg);
            }
        }
    }

    // Fetch Products
    async function fetchProducts(reset = false) {
        if (isLoading) return;
        
        // INSTANT LOAD MORE: If we have the next page cached, render it instantly!
        if (!reset && currentCursor && nextPageCache[currentCursor]) {
            renderData(nextPageCache[currentCursor], false);
            return;
        }

        // If we are resetting (switching category) and we have it cached, render it instantly!
        if (reset && !currentCursor && categoryCache[currentCategory]) {
            renderData(categoryCache[currentCategory], true);
            // We can still do a background fetch to ensure it's fresh, but no need to wait or show spinner
        } else {
            isLoading = true;
            loadingSpinner.style.display = 'flex';
            if (reset) loadMoreBtn.style.display = 'none';
        }

        try {
            const params = new URLSearchParams({ limit: 20 });
            if (currentCategory) params.append('category', currentCategory);
            if (currentCursor && !reset) params.append('cursor', currentCursor);

            const response = await fetch(`${API_BASE}/products?${params.toString()}`);
            const data = await response.json();

            // Update cache for the first page
            if (reset && !currentCursor) {
                categoryCache[currentCategory] = data;
            }

            renderData(data, reset);

        } catch (error) {
            console.error('Failed to fetch products', error);
            if (!categoryCache[currentCategory]) { // only show error if we didn't show cache
                resultsCount.textContent = 'Error loading products';
            }
        } finally {
            isLoading = false;
            loadingSpinner.style.display = 'none';
        }
    }

    // Event Listeners
    categoryFilter.addEventListener('change', (e) => {
        currentCategory = e.target.value;
        currentCursor = null;
        fetchProducts(true);
    });

    loadMoreBtn.addEventListener('click', () => {
        fetchProducts(false);
    });

    if (simulateInsertBtn) {
        simulateInsertBtn.addEventListener('click', async () => {
            simulateInsertBtn.textContent = 'Inserting...';
            simulateInsertBtn.disabled = true;
            try {
                const response = await fetch(`${API_BASE}/products/simulate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ count: 50 })
                });
                const resData = await response.json();
                if (resData.success) {
                    alert(`✅ ${resData.message}\n\n50 new products were just added to the very top of the database.\n\nNow, try clicking "Load More". Notice how you won't see any duplicates or miss any items!`);
                }
            } catch (err) {
                alert('Failed to simulate insert');
            } finally {
                simulateInsertBtn.textContent = '+ Simulate Live Insert (50)';
                simulateInsertBtn.disabled = false;
            }
        });
    }

    // Initialize
    fetchCategories();
    fetchProducts(true);
});
