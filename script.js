// script.js

// Configuration
const API_BASE_URL = 'mongodb://atlas-sql-68907be15ef99a38c3ae3759-slfc8z.a.query.mongodb.net/myVirtualDatabase?ssl=true&authSource=admin';

// State management
let currentUser = null;
let products = [];

// DOM Elements
const pages = {
    home: document.getElementById('homePage'),
    login: document.getElementById('loginPage'),
    admin: document.getElementById('adminPage')
};

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    loadProducts();
    checkAuthStatus();
});

// Event Listeners Setup
function initializeEventListeners() {
    // Navigation buttons
    document.getElementById('adminBtn').addEventListener('click', () => showPage('admin'));
    document.getElementById('loginBtn').addEventListener('click', () => showPage('login'));
    document.getElementById('backToHomeBtn').addEventListener('click', () => showPage('home'));
    document.getElementById('homeBtn').addEventListener('click', () => showPage('home'));
    document.getElementById('logoutBtn').addEventListener('click', logout);

    // Login form
    document.getElementById('loginForm').addEventListener('submit', handleLogin);

    // Admin form
    document.getElementById('addProductForm').addEventListener('submit', handleAddProduct);
    document.getElementById('chooseFileBtn').addEventListener('click', () => {
        document.getElementById('productImage').click();
    });
    document.getElementById('productImage').addEventListener('change', handleFileSelect);

    // Search functionality
    document.getElementById('searchBtn').addEventListener('click', handleSearch);
    document.getElementById('searchInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleSearch();
        }
    });
}

// Page Management
function showPage(pageName) {
    // Hide all pages
    Object.values(pages).forEach(page => page.classList.remove('active'));
    
    // Show selected page
    pages[pageName].classList.add('active');
    
    // Load page-specific data
    if (pageName === 'home') {
        loadProducts();
    } else if (pageName === 'admin') {
        if (!currentUser) {
            showPage('login');
            return;
        }
        loadAdminProducts();
    }
}

// Authentication
async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentUser = data.user;
            localStorage.setItem('token', data.token);
            showPage('admin');
            document.getElementById('loginForm').reset();
        } else {
            alert(data.message || 'Login failed');
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('Login failed. Please try again.');
    }
}

function logout() {
    currentUser = null;
    localStorage.removeItem('token');
    showPage('home');
}

function checkAuthStatus() {
    const token = localStorage.getItem('token');
    if (token) {
        // Verify token with backend
        fetch(`${API_BASE_URL}/auth/verify`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.valid) {
                currentUser = data.user;
            } else {
                localStorage.removeItem('token');
            }
        })
        .catch(error => {
            console.error('Auth check error:', error);
            localStorage.removeItem('token');
        });
    }
}

// Product Management
async function loadProducts() {
    try {
        const response = await fetch(`${API_BASE_URL}/products`);
        const data = await response.json();
        
        if (response.ok) {
            products = data;
            renderProducts(products);
        } else {
            document.getElementById('productsGrid').innerHTML = '<div class="error">Failed to load products</div>';
        }
    } catch (error) {
        console.error('Load products error:', error);
        document.getElementById('productsGrid').innerHTML = '<div class="error">Failed to load products</div>';
    }
}

async function loadAdminProducts() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/products`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const data = await response.json();
        
        if (response.ok) {
            products = data;
            renderAdminProducts(products);
        } else {
            document.getElementById('adminProductsGrid').innerHTML = '<div class="error">Failed to load products</div>';
        }
    } catch (error) {
        console.error('Load admin products error:', error);
        document.getElementById('adminProductsGrid').innerHTML = '<div class="error">Failed to load products</div>';
    }
}
console.log('product-image');
function renderProducts(productList) {
    const grid = document.getElementById('productsGrid');
    
    if (productList.length === 0) {
        grid.innerHTML = '<div class="loading">No products found</div>';
        return;
    }
    
    grid.innerHTML = productList.map(product => `
        <div class="product-card">
            <div class="product-image">
                ${product.image ? 
                    `<img src="${product.image}" alt="${product.name}">` : 
                    `<div class="default-product-icon">📦</div>`
                }
            </div>
            <div class="product-name">${product.name}</div>
            <div class="product-price">₹ ${product.price}</div>
            <button class="status-btn ${product.available ? 'available' : 'sold-out'}">
                ${product.available ? 'Available' : 'Sold Out'}
            </button>
        </div>
    `).join('');
}

function renderAdminProducts(productList) {
    const grid = document.getElementById('adminProductsGrid');
    
    if (productList.length === 0) {
        grid.innerHTML = '<div class="loading">No products found</div>';
        return;
    }
    
    grid.innerHTML = productList.map(product => `
        <div class="admin-product-card">
            <div class="product-image">
                ${product.image ? 
                    `<img src="${product.image}" alt="${product.name}">` : 
                    `<div class="default-product-icon">📦</div>`
                }
            </div>
            <div class="product-name">${product.name}</div>
            <div class="product-price">₹ ${product.price}</div>
            <button class="status-btn ${product.available ? 'available' : 'sold-out'}">
                ${product.available ? 'Available' : 'Sold Out'}
            </button>
            <div class="admin-controls">
                <button class="toggle-btn ${product.available ? 'mark-sold-out' : 'mark-available'}" 
                        onclick="toggleProductStatus('${product._id}')">
                    ${product.available ? 'Mark as sold out' : 'Mark as available'}
                </button>
                <button class="delete-btn" onclick="deleteProduct('${product._id}')">
                    DELETE
                </button>
            </div>
        </div>
    `).join('');
}

async function handleAddProduct(e) {
    e.preventDefault();
    
    const name = document.getElementById('productName').value;
    const price = document.getElementById('productPrice').value;
    const imageFile = document.getElementById('productImage').files[0];
    
    const formData = new FormData();
    formData.append('name', name);
    formData.append('price', price);
    if (imageFile) {
        formData.append('image', imageFile);
    }
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/products`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
        
        const data = await response.json();
        
        if (response.ok) {
            document.getElementById('addProductForm').reset();
            document.getElementById('fileName').textContent = 'Upload Image';
            loadAdminProducts();
            showSuccess('Product added successfully!');
        } else {
            alert(data.message || 'Failed to add product');
        }
    } catch (error) {
        console.error('Add product error:', error);
        alert('Failed to add product. Please try again.');
    }
}

async function toggleProductStatus(productId) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/products/${productId}/toggle`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            loadAdminProducts();
            showSuccess('Product status updated!');
        } else {
            alert(data.message || 'Failed to update product status');
        }
    } catch (error) {
        console.error('Toggle status error:', error);
        alert('Failed to update product status. Please try again.');
    }
}

async function deleteProduct(productId) {
    if (!confirm('Are you sure you want to delete this product?')) {
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/products/${productId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            loadAdminProducts();
            showSuccess('Product deleted successfully!');
        } else {
            alert(data.message || 'Failed to delete product');
        }
    } catch (error) {
        console.error('Delete product error:', error);
        alert('Failed to delete product. Please try again.');
    }
}

// Search functionality
function handleSearch() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    
    if (!searchTerm) {
        renderProducts(products);
        return;
    }
    
    const filteredProducts = products.filter(product => 
        product.name.toLowerCase().includes(searchTerm)
    );
    
    renderProducts(filteredProducts);
}

// File handling
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        document.getElementById('fileName').textContent = file.name;
    } else {
        document.getElementById('fileName').textContent = 'Upload Image';
    }
}

// Utility functions
function showSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'success';
    successDiv.textContent = message;
    
    const container = document.querySelector('.admin-container');
    container.insertBefore(successDiv, container.firstChild);
    
    setTimeout(() => {
        successDiv.remove();
    }, 3000);
}

// Make functions globally available for onclick handlers
window.toggleProductStatus = toggleProductStatus;
window.deleteProduct = deleteProduct;