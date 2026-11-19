import { Outlet } from 'react-router-dom';
import LandingNavbar from '../landing/LandingNavbar';
import Footer from '../landing/Footer';

export const CustomerAccountLayout = () => {
  return (
    <div className="min-h-screen bg-surface text-slate-900">
      <LandingNavbar />
      <main className="pt-24">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};

export default CustomerAccountLayout;
