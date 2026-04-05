/**
 * ============================================================================
 * TIENDASHOP - SCRIPT PRINCIPAL
 * Carrito + Google Sheets + WhatsApp + FILTRO POR CATEGORÍAS + SLIDER LOCAL
 * ============================================================================
 */

// ==================== CONFIGURACIÓN ====================
const SHEETDB_URL = 'https://sheetdb.io/api/v1/7lt07ijwk1ibp';
const APPS_SCRIPT_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbz9yR_KgBJQoZE_TqGr1pJqeAOQjL0m8M6XQroL5oEH4F5pk_AKdJh-4ZKBDgoyA084/exec';

// ==================== WHATSAPP - NÚMERO FIJO ====================
const WHATSAPP_NUMBER = '5493875048697';

// ==================== VARIABLES GLOBALES ====================
let products = [];
let cart = [];
let currentCategory = 'all';
let currentSlide = 0;
let slideInterval;

// ==================== ELEMENTOS DOM ====================
const productsContainer = document.getElementById('productsContainer');
const cartCountSpan = document.getElementById('cartCount');
const cartTotalSpan = document.getElementById('cartTotal');
const viewCartBtn = document.getElementById('viewCartBtn');
const cartModal = document.getElementById('cartModal');
const closeCartModalBtn = document.getElementById('closeCartModalBtn');
const cartItemsList = document.getElementById('cartItemsList');
const modalCartTotal = document.getElementById('modalCartTotal');
const checkoutBtn = document.getElementById('checkoutBtn');
const checkoutModal = document.getElementById('checkoutModal');
const closeCheckoutModalBtn = document.getElementById('closeCheckoutModalBtn');
const checkoutForm = document.getElementById('checkoutForm');
const toast = document.getElementById('toastMessage');
const categoriesContainer = document.getElementById('categoriesContainer');

// ==================== ELEMENTOS DEL SLIDER LOCAL ====================
const sliderTrack = document.getElementById('sliderTrack');
const sliderPrev = document.getElementById('sliderPrev');
const sliderNext = document.getElementById('sliderNext');
const sliderDots = document.getElementById('sliderDots');

// ==================== FECHA Y HORA LOCAL ====================
function getFormattedDateTime() {
    const ahora = new Date();
    const options = {
        timeZone: 'America/Argentina/Buenos_Aires',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    };
    const formatter = new Intl.DateTimeFormat('es-AR', options);
    const parts = formatter.formatToParts(ahora);
    const dateParts = {};
    parts.forEach(part => {
        if (part.type !== 'literal') dateParts[part.type] = part.value;
    });
    const fecha = `${dateParts.day}/${dateParts.month}/${dateParts.year}`;
    const hora = `${dateParts.hour}:${dateParts.minute}:${dateParts.second}`;
    return { fecha, hora, fechaCompleta: `${fecha} ${hora}` };
}

// ==================== PRODUCTOS TEXTO LEGIBLE ====================
function formatProductsText(cartItems) {
    if (!cartItems || cartItems.length === 0) return 'Sin productos';
    let productsText = '';
    cartItems.forEach((item, index) => {
        const subtotal = item.price * item.quantity;
        productsText += `${index + 1}. ${item.title} - Cantidad: ${item.quantity} x $${item.price.toFixed(2)} = $${subtotal.toFixed(2)}\n`;
    });
    return productsText.trim();
}

// ==================== TOAST ====================
function showToast(message, duration = 3000) {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), duration);
}

// ==================== LOCALSTORAGE CARRITO ====================
function saveCart() {
    localStorage.setItem('minimalCart', JSON.stringify(cart));
}
function loadCartFromStorage() {
    const stored = localStorage.getItem('minimalCart');
    if (stored) {
        try {
            cart = JSON.parse(stored);
            updateCartUI();
        } catch (e) { console.warn(e); }
    }
}
function updateCartUI() {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    cartCountSpan.innerText = totalItems;
    cartTotalSpan.innerText = `$${totalPrice.toFixed(2)}`;
    saveCart();
}

// ==================== MANEJO DE CARRITO ====================
function renderCartModal() {
    if (!cartItemsList) return;
    if (cart.length === 0) {
        cartItemsList.innerHTML = '<div class="empty-cart">🛒 El carrito está vacío. Agrega productos.</div>';
        modalCartTotal.innerText = '$0';
        return;
    }
    let html = '';
    let total = 0;
    cart.forEach((item, idx) => {
        const subtotal = item.price * item.quantity;
        total += subtotal;
        html += `
            <div class="cart-item" data-index="${idx}">
                <div class="cart-item-info">
                    <div class="cart-item-title">${escapeHtml(item.title)}</div>
                    <div class="cart-item-price">$${item.price.toFixed(2)} c/u</div>
                </div>
                <div class="cart-item-actions">
                    <button class="qty-btn" data-action="decr" data-id="${item.id}">-</button>
                    <span class="cart-item-qty">${item.quantity}</span>
                    <button class="qty-btn" data-action="incr" data-id="${item.id}">+</button>
                    <button class="remove-item" data-action="remove" data-id="${item.id}">🗑️</button>
                </div>
            </div>
        `;
    });
    cartItemsList.innerHTML = html;
    modalCartTotal.innerText = `$${total.toFixed(2)}`;

    document.querySelectorAll('.qty-btn, .remove-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const productId = btn.dataset.id;
            const action = btn.dataset.action;
            if (action === 'incr') addToCart(productId, 1);
            else if (action === 'decr') addToCart(productId, -1);
            else if (action === 'remove') removeFromCart(productId);
            renderCartModal();
            updateCartUI();
        });
    });
}
function removeFromCart(productId) {
    const index = cart.findIndex(item => item.id == productId);
    if (index !== -1) {
        cart.splice(index, 1);
        renderCartModal();
        updateCartUI();
        showToast('Producto eliminado del carrito');
    }
}
function addToCart(productId, delta = 1) {
    const product = products.find(p => p.id == productId);
    if (!product) return;
    const existing = cart.find(item => item.id == productId);
    if (existing) {
        const newQty = existing.quantity + delta;
        if (newQty <= 0) removeFromCart(productId);
        else existing.quantity = newQty;
    } else if (delta > 0) {
        cart.push({
            id: product.id,
            title: product.title,
            price: product.price,
            quantity: 1,
            image: product.image,
            description: product.description,
            category: product.category
        });
    }
    updateCartUI();
    if (delta > 0) showToast(`➕ ${product.title} agregado`);
    if (cartModal.classList.contains('active')) renderCartModal();
}

// ==================== FILTRO POR CATEGORÍAS ====================
function renderCategories() {
    const categories = [...new Set(products.map(p => p.category).filter(c => c && c.trim() !== ''))];
    categories.sort((a, b) => a.localeCompare(b));
    
    let html = `<button class="cat-btn ${currentCategory === 'all' ? 'active' : ''}" data-cat="all">🛍️ Todos los productos</button>`;
    
    categories.forEach(cat => {
        html += `<button class="cat-btn ${currentCategory === cat ? 'active' : ''}" data-cat="${escapeHtml(cat)}"> ${escapeHtml(cat)}</button>`;
    });
    
    categoriesContainer.innerHTML = html;
    
    document.querySelectorAll('.cat-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentCategory = btn.dataset.cat;
            renderCategories();
            renderProducts();
        });
    });
}

function getFilteredProducts() {
    if (currentCategory === 'all') return products;
    return products.filter(p => p.category === currentCategory);
}

// ==================== SLIDER LOCAL (IMÁGENES DEL HTML) ====================
function initLocalSlider() {
    if (!sliderTrack) return;
    
    const slides = document.querySelectorAll('.slider-slide');
    if (slides.length === 0) {
        // Si no hay slides, ocultar el slider o mostrar mensaje
        if (sliderTrack) sliderTrack.innerHTML = '<div class="slider-loading">📸 Agrega imágenes en el HTML</div>';
        return;
    }
    
    // Crear dots dinámicamente
    let dotsHtml = '';
    slides.forEach((_, idx) => {
        dotsHtml += `<div class="slider-dot ${idx === 0 ? 'active' : ''}" data-idx="${idx}"></div>`;
    });
    if (sliderDots) sliderDots.innerHTML = dotsHtml;
    
    function updateSlider() {
        sliderTrack.style.transform = `translateX(-${currentSlide * 100}%)`;
        document.querySelectorAll('.slider-dot').forEach((dot, idx) => {
            if (idx === currentSlide) dot.classList.add('active');
            else dot.classList.remove('active');
        });
    }
    
    function goToSlide(index) {
        const slidesCount = slides.length;
        if (index < 0) index = slidesCount - 1;
        if (index >= slidesCount) index = 0;
        currentSlide = index;
        updateSlider();
        resetAutoSlide();
    }
    
    function nextSlide() { goToSlide(currentSlide + 1); }
    function prevSlide() { goToSlide(currentSlide - 1); }
    
    function startAutoSlide() {
        if (slideInterval) clearInterval(slideInterval);
        if (slides.length > 1) {
            slideInterval = setInterval(() => nextSlide(), 5000);
        }
    }
    
    function resetAutoSlide() {
        if (slides.length > 1) {
            if (slideInterval) clearInterval(slideInterval);
            slideInterval = setInterval(() => nextSlide(), 3000);
        }
    }
    
    // Event listeners
    if (sliderPrev) sliderPrev.addEventListener('click', () => { prevSlide(); resetAutoSlide(); });
    if (sliderNext) sliderNext.addEventListener('click', () => { nextSlide(); resetAutoSlide(); });
    
    document.querySelectorAll('.slider-dot').forEach(dot => {
        dot.addEventListener('click', () => {
            goToSlide(parseInt(dot.dataset.idx));
            resetAutoSlide();
        });
    });
    
    const container = document.querySelector('.slider-container');
    if (container) {
        container.addEventListener('mouseenter', () => { if (slideInterval) clearInterval(slideInterval); });
        container.addEventListener('mouseleave', () => startAutoSlide());
    }
    
    startAutoSlide();
}

// ==================== LECTURA DE PRODUCTOS DESDE GOOGLE SHEETS ====================
async function fetchProducts() {
    try {
        productsContainer.innerHTML = '<div class="loading">⏳ Cargando productos...</div>';
        
        const response = await fetch(SHEETDB_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!data || data.length === 0) throw new Error('No hay datos');
        
        // Filtrar solo productos (ignorar tipo 'slider' si existe)
        products = data
            .filter(row => (row.tipo || '').toLowerCase() !== 'slider')
            .map((row, idx) => ({
                id: row.id || `prod_${idx}`,
                title: row.nombre || row.titulo || 'Producto',
                description: row.descripcion || '',
                price: parseFloat(row.precio) || 0,
                image: row.url_imagen || row.url || 'https://placehold.co/400x400?text=Sin+Imagen',
                category: row.categoria || 'Otros'
            }));
        
        // Si no hay productos, usar datos demo
        if (products.length === 0) {
            products = [
                { id: 'demo1', title: 'Lámpara Minimalista', description: 'Diseño nórdico.', price: 39.99, image: 'https://placehold.co/400x400?text=Lámpara', category: 'Lámparas' },
                { id: 'demo2', title: 'Libreta Cuero', description: '200 páginas.', price: 24.50, image: 'https://placehold.co/400x400?text=Libreta', category: 'Libretas' },
                { id: 'demo3', title: 'Velas Aromáticas', description: 'Pack x3.', price: 15.99, image: 'https://placehold.co/400x400?text=Velas', category: 'Hogar' }
            ];
        }
        
        console.log(`✅ Cargados: ${products.length} productos`);
        
        renderCategories();
        renderProducts();
        
    } catch (error) {
        console.error('Error cargando productos:', error);
        productsContainer.innerHTML = '<div class="loading">❌ Error al cargar productos. Verifica la hoja de cálculo.</div>';
        
        // Datos demo de respaldo
        products = [
            { id: 'demo1', title: 'Lámpara Minimalista', description: 'Diseño nórdico.', price: 39.99, image: 'https://placehold.co/400x400?text=Lámpara', category: 'Lámparas' },
            { id: 'demo2', title: 'Libreta Cuero', description: '200 páginas.', price: 24.50, image: 'https://placehold.co/400x400?text=Libreta', category: 'Libretas' },
            { id: 'demo3', title: 'Velas Aromáticas', description: 'Pack x3.', price: 15.99, image: 'https://placehold.co/400x400?text=Velas', category: 'Hogar' }
        ];
        renderCategories();
        renderProducts();
    }
}

function renderProducts() {
    const filteredProducts = getFilteredProducts();
    
    if (!filteredProducts.length) {
        productsContainer.innerHTML = '<div class="loading">📦 No hay productos en esta categoría.</div>';
        return;
    }
    
    let html = '';
    filteredProducts.forEach(product => {
        html += `
            <div class="product-card" data-id="${product.id}">
                <img class="product-img" src="${escapeHtml(product.image)}" alt="${escapeHtml(product.title)}" loading="lazy" onerror="this.src='https://placehold.co/400x400?text=Error+imagen'">
                <div class="product-info">
                    <h3 class="product-title">${escapeHtml(product.title)}</h3>
                    <p class="product-desc">${escapeHtml(product.description)}</p>
                    <div class="product-price">$${product.price.toFixed(2)}</div>
                    <button class="add-to-cart" data-id="${product.id}">🛒 Agregar al carrito</button>
                </div>
            </div>
        `;
    });
    productsContainer.innerHTML = html;
    
    document.querySelectorAll('.add-to-cart').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            addToCart(btn.dataset.id, 1);
        });
    });
}

// ==================== ENVÍO A GOOGLE SHEETS ====================
async function sendOrderToGoogleSheets(orderData) {
    try {
        await fetch(APPS_SCRIPT_WEBAPP_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });
        console.log('✅ Pedido enviado a hoja de cálculo');
        return true;
    } catch (error) {
        console.error('❌ Error:', error);
        return false;
    }
}

// ==================== WHATSAPP ====================
function generateWhatsAppMessage(customerName, customerAddress, cartItems, total) {
    let message = `🛍️ *Nuevo pedido - TiendaShop*%0A`;
    message += `📅 *Fecha:* ${getFormattedDateTime().fechaCompleta}%0A`;
    message += `👤 *Cliente:* ${customerName}%0A`;
    message += `📍 *Dirección:* ${customerAddress}%0A`;
    message += `────────────────%0A`;
    message += `*PRODUCTOS:*%0A`;
    cartItems.forEach((item, idx) => {
        message += `${idx + 1}. ${item.title} x${item.quantity} → $${(item.price * item.quantity).toFixed(2)}%0A`;
    });
    message += `────────────────%0A`;
    message += `💰 *TOTAL:* $${total.toFixed(2)}%0A`;
    message += `────────────────%0A`;
    message += `✅ ¡Gracias por tu compra! Tu pedido se está preparando.%0A`;
    message += `💳 ¿Con qué abonás? Efectivo / Transferencia`;
    return message;
}

async function finalizeOrder(customerName, customerAddress) {
    if (cart.length === 0) {
        showToast('El carrito está vacío');
        return false;
    }
    const total = cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    const { fecha, hora, fechaCompleta } = getFormattedDateTime();
    const productosTexto = formatProductsText(cart);

    const orderSummary = {
        fecha, hora, fechaCompleta,
        cliente: customerName,
        direccion: customerAddress,
        productos: productosTexto,
        productosRaw: cart.map(i => ({ nombre: i.title, cantidad: i.quantity, precio_unitario: i.price, subtotal: i.price * i.quantity })),
        total
    };

    await sendOrderToGoogleSheets(orderSummary);

    const whatsappMsg = generateWhatsAppMessage(customerName, customerAddress, cart, total);
    const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${whatsappMsg}`;

    window.open(whatsappUrl, '_blank');

    cart = [];
    updateCartUI();
    saveCart();
    checkoutModal.classList.remove('active');
    cartModal.classList.remove('active');
    showToast('✅ Pedido enviado. Revisa WhatsApp.');
    return true;
}

// ==================== EVENTOS ====================
function initEventListeners() {
    viewCartBtn.addEventListener('click', () => {
        renderCartModal();
        cartModal.classList.add('active');
    });
    closeCartModalBtn.addEventListener('click', () => cartModal.classList.remove('active'));
    checkoutBtn.addEventListener('click', () => {
        if (cart.length === 0) showToast('Agrega productos antes de finalizar');
        else checkoutModal.classList.add('active');
    });
    closeCheckoutModalBtn.addEventListener('click', () => checkoutModal.classList.remove('active'));

    checkoutForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('customerName').value.trim();
        const address = document.getElementById('customerAddress').value.trim();
        if (!name || !address) {
            showToast('Completa nombre y dirección');
            return;
        }
        await finalizeOrder(name, address);
        checkoutForm.reset();
    });

    window.addEventListener('click', (e) => {
        if (e.target === cartModal) cartModal.classList.remove('active');
        if (e.target === checkoutModal) checkoutModal.classList.remove('active');
    });
}

// ==================== ESCAPE HTML ====================
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, (m) => {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// ==================== INICIALIZACIÓN ====================
async function init() {
    loadCartFromStorage();
    updateCartUI();
    await fetchProducts();      // Cargar productos desde Google Sheets
    initLocalSlider();          // Iniciar slider con imágenes locales del HTML
    initEventListeners();
}

init();