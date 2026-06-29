document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements - Panels
    const chatViewContainer = document.getElementById('chat-view-container');
    const faqExplorerContainer = document.getElementById('faq-explorer-container');
    const explorerCategoryTitle = document.getElementById('explorer-category-title');
    const faqGridContainer = document.getElementById('faq-grid-container');
    const backToChatBtn = document.getElementById('back-to-chat-btn');

    // DOM Elements - Chat Area
    const sidebar = document.getElementById('sidebar');
    const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
    const faqSidebarToggleBtn = document.getElementById('faq-sidebar-toggle-btn');
    const mobileCloseBtn = document.getElementById('mobile-close-btn');
    const clearChatBtn = document.getElementById('clear-chat-btn');
    const messagesContainer = document.getElementById('messages-container');
    const suggestionsContainer = document.getElementById('suggestions-container');
    const chatInputForm = document.getElementById('chat-input-form');
    const userInput = document.getElementById('user-input');
    const navItems = document.querySelectorAll('.nav-item');

    // DOM Elements - Collapsible Status Card
    const statusHeader = document.getElementById('status-header');
    const statusMetrics = document.getElementById('status-metrics');
    const statusCollapseBtn = document.getElementById('status-collapse-btn');

    // DOM Elements - Authentication
    const loginOverlay = document.getElementById('login-overlay');
    const loginForm = document.getElementById('login-form');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const loginErrorMsg = document.getElementById('login-error-msg');
    const toSignupBtn = document.getElementById('to-signup-btn');

    // DOM Elements - Sign Up View
    const signupView = document.getElementById('signup-view');
    const signupForm = document.getElementById('signup-form');
    const signupNameInput = document.getElementById('signup-name');
    const signupEmailInput = document.getElementById('signup-email');
    const signupUsernameInput = document.getElementById('signup-username');
    const signupPasswordInput = document.getElementById('signup-password');
    const signupErrorMsg = document.getElementById('signup-error-msg');
    const toLoginBtn = document.getElementById('to-login-btn');

    // DOM Elements - Sidebar Profile
    const logoutBtn = document.getElementById('logout-btn');
    const userDisplayName = document.getElementById('user-display-name');
    const userDisplayEmail = document.getElementById('user-display-email');

    // Default suggestions mapping by category (for chat input chips)
    const categorySuggestions = {
        All: [
            "What is Aura Smart Home?",
            "How do I set up my Aura Hub?",
            "How do I connect a new smart device to Aura?",
            "What should I do if a device shows as 'Offline'?"
        ],
        Setup: [
            "How do I set up my Aura Hub?",
            "How do I reset the Aura Hub to factory settings?",
            "Does Aura work without an internet connection?"
        ],
        Devices: [
            "How do I connect a new smart device to Aura?",
            "What smart home protocols does Aura support?",
            "Can I use Aura on multiple mobile devices?"
        ],
        Automation: [
            "How do I create a custom automation routine?",
            "What are Aura Smart Routines?"
        ],
        Troubleshooting: [
            "What should I do if a device shows as 'Offline'?",
            "How do I reset the Aura Hub to factory settings?",
            "How do I update my Aura device firmware?"
        ]
    };

    let activeCategory = 'All';
    let allFaqs = []; // FAQ Database fetched from backend

    // Initialize UI
    init();

    async function init() {
        // Setup Auth Event Listeners
        loginForm.addEventListener('submit', handleLogin);
        signupForm.addEventListener('submit', handleSignup);
        logoutBtn.addEventListener('click', handleLogout);

        // Toggle Links
        toSignupBtn.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('login-view').classList.add('hidden');
            signupView.classList.remove('hidden');
            loginErrorMsg.textContent = '';
            signupErrorMsg.textContent = '';
        });

        toLoginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            signupView.classList.add('hidden');
            document.getElementById('login-view').classList.remove('hidden');
            loginErrorMsg.textContent = '';
            signupErrorMsg.textContent = '';
        });

        // Setup Collapsible Status card
        statusHeader.addEventListener('click', toggleStatusCard);
        
        // Restore collapse state
        if (localStorage.getItem('status_card_collapsed') === 'true') {
            statusMetrics.classList.add('collapsed');
            statusCollapseBtn.classList.add('collapsed');
        }

        // Check current session state
        const isAuthenticated = checkAuth();

        if (isAuthenticated) {
            showWelcomeMessage();
            await fetchFaqs();
        }

        // Render initial suggestions
        renderSuggestions(categorySuggestions[activeCategory]);
        
        // Setup Chat Event Listeners
        sidebarToggleBtn.addEventListener('click', () => sidebar.classList.add('open'));
        faqSidebarToggleBtn.addEventListener('click', () => sidebar.classList.add('open'));
        mobileCloseBtn.addEventListener('click', () => sidebar.classList.remove('open'));
        clearChatBtn.addEventListener('click', clearChat);
        chatInputForm.addEventListener('submit', handleFormSubmit);

        // Setup FAQ Explorer Event Listeners
        backToChatBtn.addEventListener('click', switchToChatView);

        // Sidebar Navigation
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                navItems.forEach(btn => btn.classList.remove('active'));
                const btn = e.currentTarget;
                btn.classList.add('active');
                
                activeCategory = btn.getAttribute('data-category');
                
                if (activeCategory === 'All') {
                    switchToChatView();
                } else {
                    switchToFaqExplorerView(activeCategory, btn.querySelector('span').textContent);
                }
                
                // Close sidebar on mobile
                if (window.innerWidth <= 820) {
                    sidebar.classList.remove('open');
                }
            });
        });

        // Initialize icons
        lucide.createIcons();
    }

    // Toggle Status Card collapse
    function toggleStatusCard() {
        const isCollapsed = statusMetrics.classList.toggle('collapsed');
        statusCollapseBtn.classList.toggle('collapsed');
        localStorage.setItem('status_card_collapsed', isCollapsed);
    }

    // Fetch entire FAQ list from the server
    async function fetchFaqs() {
        try {
            const response = await fetch('/api/faqs', {
                headers: { 'Connection': 'close' }
            });
            if (response.ok) {
                allFaqs = await response.json();
            }
        } catch (err) {
            console.error("Error fetching FAQs:", err);
            // Fallback FAQs in case server isn't responsive yet
            allFaqs = [];
        }
    }

    // Switch View Panel to FAQ Explorer
    function switchToFaqExplorerView(category, displayName) {
        chatViewContainer.classList.add('hidden');
        faqExplorerContainer.classList.remove('hidden');
        explorerCategoryTitle.textContent = displayName;

        // Filter and Render FAQs
        const filtered = allFaqs.filter(faq => faq.category === category);
        renderFaqGrid(filtered);
    }

    // Render Grid of FAQ cards
    function renderFaqGrid(faqs) {
        faqGridContainer.innerHTML = '';
        
        if (faqs.length === 0) {
            faqGridContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px;">No FAQs found in this category.</div>`;
            return;
        }

        faqs.forEach(faq => {
            const card = document.createElement('div');
            card.classList.add('faq-card');
            
            const question = document.createElement('h3');
            question.classList.add('faq-card-question');
            question.textContent = faq.question;

            const answer = document.createElement('p');
            answer.classList.add('faq-card-answer');
            answer.textContent = faq.answer;

            const tagRow = document.createElement('div');
            tagRow.classList.add('faq-card-tag-row');
            
            if (faq.tags) {
                faq.tags.forEach(t => {
                    const tag = document.createElement('span');
                    tag.classList.add('faq-card-tag');
                    tag.textContent = t;
                    tagRow.appendChild(tag);
                });
            }

            card.appendChild(question);
            card.appendChild(answer);
            card.appendChild(tagRow);

            // Click interaction: Ask this question in the chat!
            card.style.cursor = 'pointer';
            card.title = "Click to ask Aura Assistant about this";
            card.addEventListener('click', () => {
                switchToChatView();
                askQuestion(faq.question);
            });

            faqGridContainer.appendChild(card);
        });
    }

    // Switch View Panel back to Chat
    function switchToChatView() {
        faqExplorerContainer.classList.add('hidden');
        chatViewContainer.classList.remove('hidden');

        // Reset sidebar active item highlight to "All FAQs"
        navItems.forEach(btn => {
            if (btn.getAttribute('data-category') === 'All') {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        activeCategory = 'All';
        renderSuggestions(categorySuggestions[activeCategory]);
    }

    // Check Auth State and Update UI Overlay
    function checkAuth() {
        const token = localStorage.getItem('aura_session_token');
        const userJson = localStorage.getItem('aura_user_info');
        
        if (token && userJson) {
            try {
                const user = JSON.parse(userJson);
                loginOverlay.classList.add('hidden');
                userDisplayName.textContent = user.name || 'User';
                userDisplayEmail.textContent = user.email || 'user@aura.io';
                return true;
            } catch (e) {
                console.error("Failed to parse user details:", e);
            }
        }
        
        loginOverlay.classList.remove('hidden');
        return false;
    }

    // Show initial welcome message
    function showWelcomeMessage() {
        messagesContainer.innerHTML = '';
        addMessage('bot', `Hello! I am your **Aura Smart Assistant**. Ask me anything about setting up your Aura Hub, pairing devices, configuring automation routines, or troubleshooting network offline issues.`);
    }

    // Handle Login Form Submission
    async function handleLogin(e) {
        e.preventDefault();
        loginErrorMsg.textContent = '';
        
        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();
        
        const submitBtn = document.getElementById('login-submit-btn');
        const originalBtnContent = submitBtn.innerHTML;
        
        // Loading state
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span>Logging in...</span>`;
        
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Connection': 'close'
                },
                body: JSON.stringify({ username, password })
            });
            
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnContent;
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                localStorage.setItem('aura_session_token', data.token);
                localStorage.setItem('aura_user_info', JSON.stringify(data.user));
                
                checkAuth();
                showWelcomeMessage();
                await fetchFaqs();
                
                // Clear input fields
                usernameInput.value = '';
                passwordInput.value = '';
                
                userInput.focus();
            } else {
                loginErrorMsg.textContent = data.error || 'Authentication failed. Please try again.';
            }
        } catch (error) {
            console.error("Login request error:", error);
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnContent;
            loginErrorMsg.textContent = 'Server connection error. Please ensure the Python server is running.';
        }
    }

    // Handle Sign Up Form Submission
    async function handleSignup(e) {
        e.preventDefault();
        signupErrorMsg.textContent = '';

        const name = signupNameInput.value.trim();
        const email = signupEmailInput.value.trim();
        const username = signupUsernameInput.value.trim();
        const password = signupPasswordInput.value.trim();

        const submitBtn = document.getElementById('signup-submit-btn');
        const originalBtnContent = submitBtn.innerHTML;

        // Loading state
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span>Creating Account...</span>`;

        try {
            const response = await fetch('/api/signup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Connection': 'close'
                },
                body: JSON.stringify({ name, email, username, password })
            });

            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnContent;

            const data = await response.json();

            if (response.ok && data.success) {
                alert("Account created successfully! You can now log in.");
                
                // Reset form fields
                signupNameInput.value = '';
                signupEmailInput.value = '';
                signupUsernameInput.value = '';
                signupPasswordInput.value = '';

                // Transition to Login
                signupView.classList.add('hidden');
                document.getElementById('login-view').classList.remove('hidden');
                
                // Auto-fill username in login form
                usernameInput.value = username;
                passwordInput.focus();
            } else {
                signupErrorMsg.textContent = data.error || 'Registration failed. Please try again.';
            }
        } catch (error) {
            console.error("Signup request error:", error);
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnContent;
            signupErrorMsg.textContent = 'Server connection error. Please ensure the Python server is running.';
        }
    }

    // Handle Logout Event
    async function handleLogout() {
        if (confirm("Are you sure you want to log out of Aura?")) {
            try {
                await fetch('/api/logout', {
                    method: 'POST',
                    headers: {
                        'Connection': 'close'
                    }
                });
            } catch (err) {
                console.error("Logout request error:", err);
            }
            
            // Clear storage and state
            localStorage.removeItem('aura_session_token');
            localStorage.removeItem('aura_user_info');
            messagesContainer.innerHTML = '';
            allFaqs = [];
            
            checkAuth();
        }
    }

    // Clear Chat History
    function clearChat() {
        if (confirm("Are you sure you want to clear your chat history?")) {
            showWelcomeMessage();
        }
    }

    // Add a message bubble
    function addMessage(sender, text, similarity = null) {
        const messageRow = document.createElement('div');
        messageRow.classList.add('message-row', sender);

        const bubble = document.createElement('div');
        bubble.classList.add('message-bubble');

        // Formats basic markdown bolding
        let formattedText = text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>')
            .replace(/(\d+\.\s)/g, '<br><strong>$1</strong>');

        bubble.innerHTML = formattedText;

        // Add similarity badge if it exists
        if (similarity !== null && sender === 'bot') {
            const pct = Math.round(similarity * 100);
            const badge = document.createElement('span');
            badge.classList.add('similarity-badge');
            badge.textContent = `Match: ${pct}%`;
            bubble.appendChild(badge);
        }

        const time = document.createElement('span');
        time.classList.add('message-time');
        const now = new Date();
        time.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        bubble.appendChild(time);

        messageRow.appendChild(bubble);
        messagesContainer.appendChild(messageRow);
        
        // Auto Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Render Suggestion Chips
    function renderSuggestions(questions) {
        suggestionsContainer.innerHTML = '';
        questions.forEach(q => {
            const chip = document.createElement('button');
            chip.classList.add('suggestion-chip');
            chip.textContent = q;
            chip.addEventListener('click', () => {
                // Prevent actions if not logged in
                if (!localStorage.getItem('aura_session_token')) {
                    checkAuth();
                    return;
                }
                askQuestion(q);
            });
            suggestionsContainer.appendChild(chip);
        });
    }

    // Handle Form Submit
    function handleFormSubmit(e) {
        e.preventDefault();
        
        // Prevent actions if not logged in
        if (!localStorage.getItem('aura_session_token')) {
            checkAuth();
            return;
        }

        const text = userInput.value.trim();
        if (!text) return;
        
        askQuestion(text);
        userInput.value = '';
    }

    // Send question to backend API
    async function askQuestion(question) {
        // Add User Message bubble
        addMessage('user', question);

        // Add Bot Typing Indicator
        const typingId = showTypingIndicator();

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Connection': 'close'
                },
                body: JSON.stringify({ question: question })
            });

            removeTypingIndicator(typingId);

            if (!response.ok) {
                throw new Error("HTTP error " + response.status);
            }

            const data = await response.json();
            
            if (data.success && data.match) {
                // Perfect or close match found
                addMessage('bot', data.match.answer, data.match.similarity);
                if (data.suggestions && data.suggestions.length > 0) {
                    renderSuggestions(data.suggestions);
                }
            } else {
                // Below similarity threshold fallback
                addMessage('bot', data.answer || "I'm sorry, I couldn't find an answer to that question.");
                if (data.suggestions && data.suggestions.length > 0) {
                    renderSuggestions(data.suggestions);
                }
            }
        } catch (error) {
            console.error("Fetch error:", error);
            removeTypingIndicator(typingId);
            addMessage('bot', "Connection error: I was unable to reach the Aura NLP server. Please ensure the Python server is running.");
        }
    }

    // Show Typing Indicator bubble
    function showTypingIndicator() {
        const messageRow = document.createElement('div');
        const id = 'typing-' + Date.now();
        messageRow.id = id;
        messageRow.classList.add('message-row', 'bot');

        const bubble = document.createElement('div');
        bubble.classList.add('message-bubble');

        const indicator = document.createElement('div');
        indicator.classList.add('typing-indicator');
        
        for (let i = 0; i < 3; i++) {
            const dot = document.createElement('div');
            dot.classList.add('typing-dot');
            indicator.appendChild(dot);
        }

        bubble.appendChild(indicator);
        messageRow.appendChild(bubble);
        messagesContainer.appendChild(messageRow);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        return id;
    }

    // Remove Typing Indicator bubble
    function removeTypingIndicator(id) {
        const indicator = document.getElementById(id);
        if (indicator) {
            indicator.remove();
        }
    }
});
