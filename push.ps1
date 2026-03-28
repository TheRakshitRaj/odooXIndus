# git init (already initialized)
git remote add origin https://github.com/TheRakshitRaj/odooXIndus.git

# 1. Base Project Config
git add package.json package-lock.json vite.config.js eslint.config.js .gitignore index.html README.md
git commit -m "Initial commit: Configure React Vite project, dependencies, and Tailwind"

# 2. Main Entry Points
git add src/main.jsx src/App.jsx src/index.css
git commit -m "Add core application routing and global claymorphism styles"

# 3. Context & Services
git add src/context/ src/services/ src/utils/
git commit -m "Implement global state management, role-based auth, and Supabase integration"

# 4. UI Components
git add src/components/
git commit -m "Build reusable UI components (Chatbot, Navbar, Sidebar) with unified aesthetics"

# 5. Core Views
git add src/pages/Dashboard.jsx src/pages/Products.jsx src/pages/Receipts.jsx src/pages/Deliveries.jsx src/pages/Transfers.jsx src/pages/Adjustments.jsx
git commit -m "Implement core inventory management dashboards and CRUD interfaces"

# 6. Auth Views
git add src/pages/Login.jsx src/pages/Signup.jsx src/pages/ForgotPassword.jsx src/pages/ResetPassword.jsx src/pages/OTPVerification.jsx
git commit -m "Implement JWT and OTP based authentication flows"

# 7. Analytics & Ledger Views
git add src/pages/Analytics.jsx src/pages/BlockchainLedger.jsx src/pages/Unauthorized.jsx
git commit -m "Add data visualization and immutable ledger views"

# 8. Backend & Scripts
git add server/ scripts/
git commit -m "Add Node.js OTP microservice and knowledge synchronization scripts"

# 9. Reference Assets
git add screens/ public/
git commit -m "Add static assets and HTML/CSS design references"

# 10. Remaining Files
git add .
git commit -m "Final polish and application integration"

# Push
git push -u origin HEAD:main --force
