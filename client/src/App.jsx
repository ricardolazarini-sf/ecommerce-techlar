import { Routes, Route, Link } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import HomePage from './pages/HomePage.jsx';
import CatalogPage from './pages/CatalogPage.jsx';
import ProductPage from './pages/ProductPage.jsx';
import CartPage from './pages/CartPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import CheckoutPage from './pages/CheckoutPage.jsx';
import OrderConfirmationPage from './pages/OrderConfirmationPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import WishlistPage from './pages/WishlistPage.jsx';

function NotFound() {
  return (
    <div className="empty-state">
      <div className="big">🔌</div>
      <h2>Página não encontrada</h2>
      <p>O link que você seguiu pode estar quebrado.</p>
      <Link to="/" className="btn btn-primary">
        Voltar para a home
      </Link>
    </div>
  );
}

export default function App() {
  return (
    <div className="app">
      <Navbar />
      <main>
        <div className="container">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/produtos" element={<CatalogPage />} />
            <Route path="/produtos/:id" element={<ProductPage />} />
            <Route path="/carrinho" element={<CartPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/cadastro" element={<RegisterPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/pedido/:orderNumber" element={<OrderConfirmationPage />} />
            <Route
              path="/perfil"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/lista-de-desejos"
              element={
                <ProtectedRoute>
                  <WishlistPage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </main>
      <Footer />
    </div>
  );
}
