// Global state
let currentUser = null;
let pieChart = null;
let barChart = null;
let isCheckingLogin = false;
let availablePeriods = [];
let isProgrammaticPeriodUpdate = false;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    initializeYearDropdown();
    setupEventListeners();
    checkLogin();
});

// Initialize year dropdown with current and past years
function initializeYearDropdown() {
    const yearSelect = document.getElementById('year');
    if (!yearSelect) return;

    const currentYear = new Date().getFullYear();
    for (let i = 0; i <= 5; i++) {
        const year = currentYear - i;
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearSelect.appendChild(option);
    }
}

// Setup event listeners
function setupEventListeners() {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) loginForm.addEventListener('submit', handleLogin);

    const registerForm = document.getElementById('registerForm');
    if (registerForm) registerForm.addEventListener('submit', handleRegister);

    const showRegisterBtn = document.getElementById('showRegister');
    if (showRegisterBtn) showRegisterBtn.addEventListener('click', (e) => {
        e.preventDefault();
        showRegisterSection();
    });

    const showLoginBtn = document.getElementById('showLogin');
    if (showLoginBtn) showLoginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        showLoginSection();
    });

    const googleLoginBtn = document.getElementById('googleLoginBtn');
    if (googleLoginBtn) googleLoginBtn.addEventListener('click', handleGoogleLogin);

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

    const insightsBtn = document.getElementById('insightsBtn');
    if (insightsBtn) insightsBtn.addEventListener('click', handleInsights);

    const insightsCloseBtn = document.getElementById('insightsCloseBtn');
    if (insightsCloseBtn) insightsCloseBtn.addEventListener('click', closeInsightsModal);

    const insightsOverlay = document.getElementById('insightsModal');
    if (insightsOverlay) insightsOverlay.addEventListener('click', (e) => {
        if (e.target === insightsOverlay) closeInsightsModal();
    });

    const uploadForm = document.getElementById('uploadForm');
    if (uploadForm) uploadForm.addEventListener('submit', handleUpload);

    const clearBtn = document.getElementById('clearBtn');
    if (clearBtn) clearBtn.addEventListener('click', handleClear);

    const monthSelect = document.getElementById('month');
    if (monthSelect) monthSelect.addEventListener('change', handlePeriodSelectionChange);

    const yearSelect = document.getElementById('year');
    if (yearSelect) yearSelect.addEventListener('change', handlePeriodSelectionChange);
}

// Check if user is already logged in
async function checkLogin() {
    // Prevent multiple simultaneous checks
    if (isCheckingLogin) return;
    isCheckingLogin = true;

    try {
        const response = await fetch('/api/user', {
            credentials: 'include'
        });
        const data = await response.json();

        if (data.success) {
            currentUser = data.user;
            if (window.location.pathname.endsWith('/dashboard')) {
                showDashboard();
            }
            // Do not redirect to /dashboard from home automatically
            // Only show dashboard if already on dashboard.html
            return;
        }
    } catch (error) {
        console.error('Check login error:', error);
    } finally {
        isCheckingLogin = false;
    }

    // If not authenticated and on dashboard, redirect to home
    if (window.location.pathname.endsWith('/dashboard.html')) {
        window.location.href = '/';
    }
}


// Handle login
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();

    if (!email || !password) {
        alert('Please enter both email and password');
        return;
    }

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        if (data.success) {
            currentUser = data.user;
            // Small delay to ensure session is saved
           // setTimeout(() => {
                window.location.href = '/dashboard';
           // }, 2000);
        } else {
            alert(data.error || 'Login failed');
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('An error occurred during login');
    }
}

// Handle logout
async function handleLogout() {
    try {
        await fetch('/api/logout', { method: 'POST', credentials: 'include' });
    } catch (error) {
        console.error('Logout error:', error);
    }
    currentUser = null;
    localStorage.removeItem('financeManagerUser');
    clearResults();
    window.location.href = '/';
}

// Handle registration
async function handleRegister(e) {
    e.preventDefault();
    const userId = document.getElementById('regUserId').value.trim();
    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value.trim();
    
    if (!userId || !name || !email || !password) {
        alert('Please fill all fields.');
        return;
    }
    
    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ userId, name, email, password }),
        });

        const data = await response.json();

        if (data.success) {
            alert('Registration successful! Please login.');
            showLoginSection();
        } else {
            alert(data.error || 'Registration failed');
        }
    } catch (error) {
        console.error('Registration error:', error);
        alert('An error occurred during registration');
    }
}

// Password validation
function validatePassword(password) {
    // At least 1 uppercase, 1 number, 1 special character, no repeated letters
    const hasUpper = /[A-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    const noRepeats = !/(.)\1/.test(password); // No consecutive repeats
    
    return hasUpper && hasNumber && hasSpecial && noRepeats;
}

// Handle Google login
function handleGoogleLogin() {
    window.location.href = '/auth/google';
}

// Show login section
function showLoginSection() {
    const loginSection = document.getElementById('loginSection');
    const registerSection = document.getElementById('registerSection');
    const dashboardSection = document.getElementById('dashboardSection');

    if (loginSection) loginSection.style.display = 'flex';
    if (registerSection) registerSection.style.display = 'none';
    if (dashboardSection) dashboardSection.style.display = 'none';
}

// Show register section
function showRegisterSection() {
    const loginSection = document.getElementById('loginSection');
    const registerSection = document.getElementById('registerSection');
    const dashboardSection = document.getElementById('dashboardSection');

    if (loginSection) loginSection.style.display = 'none';
    if (registerSection) registerSection.style.display = 'flex';
    if (dashboardSection) dashboardSection.style.display = 'none';
}

// Show dashboard section
function showDashboard() {
    const loginSection = document.getElementById('loginSection');
    const registerSection = document.getElementById('registerSection');
    const dashboardSection = document.getElementById('dashboardSection');
    const welcomeUserElem = document.getElementById('welcomeUser');
console.log('Showing dashboard for user:', currentUser);
console.log('Login section:', loginSection, 'Register section:', registerSection, 'Dashboard section:', dashboardSection, 'Welcome user element:', welcomeUserElem);
    if (loginSection) loginSection.style.display = 'none';
    if (registerSection) registerSection.style.display = 'none';
    if (dashboardSection) dashboardSection.style.display = 'block';
    if (welcomeUserElem && currentUser) welcomeUserElem.textContent = `Welcome, ${currentUser.name || currentUser.email}`;

    initializeDashboardData();
}

// Load dashboard with the latest available month and keep selectors usable for switching periods.
async function initializeDashboardData() {
    await refreshAvailablePeriods();
}

async function refreshAvailablePeriods(preferredPeriod = null) {
    try {
        const response = await fetch('/api/statements/available-periods', {
            method: 'GET',
            credentials: 'include'
        });

        const result = await response.json();
        if (!result.success) {
            availablePeriods = [];
            clearResults();
            clearStatus();
            return;
        }

        availablePeriods = result.data || [];
        if (availablePeriods.length === 0) {
            clearResults();
            clearStatus();
            return;
        }

        const targetPeriod = preferredPeriod && availablePeriods.some((p) => p.month === preferredPeriod.month && p.year === preferredPeriod.year)
            ? preferredPeriod
            : availablePeriods[0];

        setSelectedPeriod(targetPeriod.month, targetPeriod.year);
        await loadStatementDataForPeriod(targetPeriod.month, targetPeriod.year);
    } catch (error) {
        console.error('Error loading available periods:', error);
        clearResults();
        clearStatus();
    }
}

function setSelectedPeriod(month, year) {
    const monthSelect = document.getElementById('month');
    const yearSelect = document.getElementById('year');

    if (!monthSelect || !yearSelect) return;

    ensureYearOption(year);

    isProgrammaticPeriodUpdate = true;
    monthSelect.value = month;
    yearSelect.value = year;
    isProgrammaticPeriodUpdate = false;
}

function ensureYearOption(year) {
    const yearSelect = document.getElementById('year');
    if (!yearSelect || !year) return;

    const hasYear = Array.from(yearSelect.options).some((option) => option.value === String(year));
    if (!hasYear) {
        const option = document.createElement('option');
        option.value = String(year);
        option.textContent = String(year);
        yearSelect.appendChild(option);
    }
}

async function handlePeriodSelectionChange() {
    if (isProgrammaticPeriodUpdate) return;

    const month = document.getElementById('month')?.value;
    const year = document.getElementById('year')?.value;

    if (!month || !year) return;

    const exists = availablePeriods.some((period) => period.month === month && period.year === year);
    if (!exists) {
        clearResults();
        showStatus('No uploaded data found for selected month and year', 'error');
        return;
    }

    await loadStatementDataForPeriod(month, year);
}

async function loadStatementDataForPeriod(month, year) {
    try {
        showLoading(true);

        const response = await fetch(`/api/statements/data?month=${encodeURIComponent(month)}&year=${encodeURIComponent(year)}`, {
            method: 'GET',
            credentials: 'include'
        });

        const result = await response.json();

        if (!result.success) {
            clearResults();
            showStatus(result.error || 'Failed to load selected month data', 'error');
            return;
        }

        clearStatus();
        displayResults(result.data);
    } catch (error) {
        console.error('Error loading statement data:', error);
        clearResults();
        showStatus('An error occurred while loading selected month data', 'error');
    } finally {
        showLoading(false);
    }
}

// Handle file upload
async function handleUpload(e) {
    e.preventDefault();
    
    const fileInput = document.getElementById('pdfFile');
    const month = document.getElementById('month').value;
    const year = document.getElementById('year').value;
    const file = fileInput.files[0];
    
    // Validate inputs
    if (!file || !month || !year) {
        showStatus('Please fill all fields', 'error');
        return;
    }
    
    // Validate file size
    if (file.size > 5 * 1024 * 1024) {
        showStatus('File size exceeds 5MB limit', 'error');
        return;
    }
    
    // Show loading
    showLoading(true);
    clearStatus();
    
    // Create form data
    const formData = new FormData();
    formData.append('pdfFile', file);
    formData.append('month', month);
    formData.append('year', year);
    // userId is now obtained from session on server side
    
    try {
        const response = await fetch('/api/upload', {
            method: 'POST',
            credentials: 'include',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            showStatus('Statement processed successfully!', 'success');
            displayResults(result.data);
            await refreshAvailablePeriods({ month, year });
        } else {
            showStatus(result.error || 'Failed to process statement', 'error');
        }
    } catch (error) {
        console.error('Upload error:', error);
        showStatus('An error occurred during upload', 'error');
    } finally {
        showLoading(false);
    }
}

// Display results
function displayResults(data) {
    const { categories } = data;
    
    // Update summary cards
    document.getElementById('salaryAmount').textContent = formatCurrency(categories.salary);
    document.getElementById('savingsAmount').textContent = formatCurrency(categories.savings);
    document.getElementById('shoppingAmount').textContent = formatCurrency(categories.shopping_merc);
    document.getElementById('billsAmount').textContent = formatCurrency(categories.bills);
    document.getElementById('transfersAmount').textContent = formatCurrency(categories.transfers);
    document.getElementById('foodOrderAmount').textContent = formatCurrency(categories.food_orders);
    document.getElementById('otherAmount').textContent = formatCurrency(categories.others);
    // Update charts
    updatePieChart(categories);
    updateBarChart(categories);
    
    // Update table
   //  updateTransactionsTable(transactions);
    
    // Show results section
    document.getElementById('resultsSection').style.display = 'block';
    
    // Scroll to results
    document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth' });
}

// Update pie chart
function updatePieChart(categories) {
    const ctx = document.getElementById('pieChart').getContext('2d');
    
    // Destroy existing chart if it exists
    if (pieChart) {
        pieChart.destroy();
    }
    
    // Filter out categories with zero values for cleaner chart
    const labels = [];
    const data = [];
    const colors = [];
    
    const categoryColors = {
        savings: '#2196f3',
        shopping: '#ff9800',
        bills: '#f44336',
        transfers: '#9c27b0',
        other: '#607d8b'
    };
    
    Object.entries(categories).forEach(([key, value]) => {
        if (key !== 'salary' && value > 0) {
            labels.push(key.charAt(0).toUpperCase() + key.slice(1));
            data.push(value);
            colors.push(categoryColors[key] || '#999');
        }
    });
    
    pieChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${label}: ₹${value.toLocaleString('en-IN')} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// Update bar chart
function updateBarChart(categories) {
    const ctx = document.getElementById('barChart').getContext('2d');
    
    // Destroy existing chart if it exists
    if (barChart) {
        barChart.destroy();
    }
    
    const labels = [];
    const data = [];
    const colors = [];
    
    const categoryColors = {
        salary: '#4caf50',
        savings: '#2196f3',
        shopping: '#ff9800',
        bills: '#f44336',
        transfers: '#9c27b0',
        other: '#607d8b'
    };
    
    Object.entries(categories).forEach(([key, value]) => {
        labels.push(key.charAt(0).toUpperCase() + key.slice(1));
        data.push(value);
        colors.push(categoryColors[key] || '#999');
    });
    
    barChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Amount (₹)',
                data: data,
                backgroundColor: colors,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `₹${context.parsed.y.toLocaleString('en-IN')}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '₹' + value.toLocaleString('en-IN');
                        }
                    }
                }
            }
        }
    });
}

// Update transactions table
// function updateTransactionsTable(transactions) {
//     const tbody = document.getElementById('transactionsBody');
//     tbody.innerHTML = '';
    
//     if (!transactions || transactions.length === 0) {
//         tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No transactions found</td></tr>';
//         return;
//     }
    
//     transactions.forEach(txn => {
//         const row = document.createElement('tr');
        
//         const date = new Date(txn.date);
//         const formattedDate = date.toLocaleDateString('en-IN', {
//             day: '2-digit',
//             month: 'short',
//             year: 'numeric'
//         });
        
//         row.innerHTML = `
//             <td>${formattedDate}</td>
//             <td>${txn.description}</td>
//             <td style="font-weight: bold;">₹${txn.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
//             <td>₹${txn.balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
//             <td><span class="badge ${txn.type}">${txn.type || 'None'}</span></td>
//         `;
        
//         tbody.appendChild(row);
//     });
// }

// Show/hide loading overlay
function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (show) {
        overlay.classList.add('active');
    } else {
        overlay.classList.remove('active');
    }
}

// Show status message
function showStatus(message, type) {
    const statusDiv = document.getElementById('uploadStatus');
    statusDiv.textContent = message;
    statusDiv.className = `status-message ${type}`;
}

// Clear status message
function clearStatus() {
    const statusDiv = document.getElementById('uploadStatus');
    statusDiv.textContent = '';
    statusDiv.className = 'status-message';
}

// Clear results
function clearResults() {
    document.getElementById('resultsSection').style.display = 'none';
   // document.getElementById('transactionsBody').innerHTML = '';
    
    if (pieChart) {
        pieChart.destroy();
        pieChart = null;
    }
    
    if (barChart) {
        barChart.destroy();
        barChart = null;
    }
}

// Handle clear button — resets form, status, and results
function handleClear() {
    const uploadForm = document.getElementById('uploadForm');
    if (uploadForm) uploadForm.reset();
    clearStatus();
    clearResults();
}

// Show / hide insights modal
function openInsightsModal() {
    document.getElementById('insightsModal').style.display = 'flex';
    document.getElementById('insightsLoading').style.display = 'flex';
    document.getElementById('insightsContent').style.display = 'none';
    document.getElementById('insightsError').style.display = 'none';
}

function closeInsightsModal() {
    document.getElementById('insightsModal').style.display = 'none';
}

// Handle Insights button click
async function handleInsights() {
    openInsightsModal();

    try {
        const response = await fetch('/api/insights', {
            method: 'GET',
            credentials: 'include'
        });

        const data = await response.json();

        document.getElementById('insightsLoading').style.display = 'none';

        if (!data.success) {
            const errEl = document.getElementById('insightsError');
            errEl.textContent = data.error || 'Failed to load insights.';
            errEl.style.display = 'block';
            return;
        }

        const { insights } = data;

        // Overview
        document.getElementById('insightsText').textContent = insights.insights || '';

        // Category highlights
        const catList = document.getElementById('insightsCategoryList');
        catList.innerHTML = '';
        (insights.category_highlights || []).forEach(h => {
            const li = document.createElement('li');
            li.innerHTML = `<strong>${h.category}:</strong> ${h.observation}`;
            catList.appendChild(li);
        });

        // Savings summary
        document.getElementById('insightsSavingsSummary').textContent = insights.savings_summary || '';

        // Suggestions
        const sugList = document.getElementById('insightsSuggestionsList');
        sugList.innerHTML = '';
        (insights.suggestions || []).forEach(s => {
            const li = document.createElement('li');
            li.textContent = s;
            sugList.appendChild(li);
        });

        document.getElementById('insightsContent').style.display = 'block';

    } catch (error) {
        console.error('Insights error:', error);
        document.getElementById('insightsLoading').style.display = 'none';
        const errEl = document.getElementById('insightsError');
        errEl.textContent = 'An error occurred while fetching insights.';
        errEl.style.display = 'block';
    }
}

// Format currency
function formatCurrency(amount) {
    if(amount === undefined || amount === null) amount = 0;
    return '₹' + amount.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}
