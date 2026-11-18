import React from 'react';
import { Link } from 'react-router-dom';
const logoImg = '/assets/file.png';
import { MapPin, Phone, Mail, ArrowUp } from 'lucide-react';
import { useGetContactQuery } from '../../../services/cmsApi';

const FacebookIcon = ({ className = '' }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

const WhatsAppIcon = ({ className = '' }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="12" fill="#25D366" />
    <path
      d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.472-.148-.672.15-.198.297-.768.967-.942 1.165-.173.198-.347.223-.644.075-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.372-.025-.521-.075-.148-.672-1.612-.922-2.207-.242-.579-.487-.5-.672-.51l-.573-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.26.489 1.692.626.71.226 1.357.194 1.87.118.57-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.413-.074-.122-.272-.198-.57-.347z"
      fill="#fff"
    />
  </svg>
);

const InstagramIcon = ({ className = '' }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
  </svg>
);

const scrollToTop = (e: React.MouseEvent<HTMLAnchorElement>): void => {
  e.preventDefault();
  window.scrollTo({
    top: 0,
    behavior: 'smooth',
  });
};

const Footer: React.FC = () => {
  const { data: contact } = useGetContactQuery();

  const phone = contact?.phone || '+91 7389453119';
  const email = contact?.email || 'support@madalsacouture.com';
  const address = contact?.address || 'Madalsa Couture, India';
  const waNumber = phone.replace(/\D/g, '') || '917389453119';

  return (
    <footer className="bg-[#FEFBF7] border-t border-[#E8DCC8]">
      {/* Main Footer Content */}
      <div className="max-w-7xl mx-auto px-6 py-16 lg:py-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 lg:gap-16">
          {/* Brand Section */}
          <div className="flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <img src={logoImg} alt="Madalsa logo" className="h-14 w-auto object-contain" />
              </div>
              <p className="mt-2 max-w-xs text-xs sm:text-sm font-medium leading-relaxed text-[#6B5344]">
                Curated womenswear with luxurious edits, seasonal drops, and timeless silhouettes.
              </p>
            </div>
          </div>

          {/* Quick Links Section */}
          <div>
            <h3 className="font-semibold text-xs uppercase tracking-widest text-[#7A5A45] mb-6 pb-3 border-b border-[#E2CBA6]">
              Quick Links
            </h3>
            <ul className="space-y-3.5">
              <li>
                <Link to="/" className="text-xs sm:text-sm font-medium text-[#6B5344] hover:text-[#A97B45] transition-colors duration-200">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/products" className="text-xs sm:text-sm font-medium text-[#6B5344] hover:text-[#A97B45] transition-colors duration-200">
                  Shop
                </Link>
              </li>
              <li>
                <Link to="/about" className="text-xs sm:text-sm font-medium text-[#6B5344] hover:text-[#A97B45] transition-colors duration-200">
                  About Us
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-xs sm:text-sm font-medium text-[#6B5344] hover:text-[#A97B45] transition-colors duration-200">
                  Contact Us
                </Link>
              </li>
              <li>
                <Link to="/terms" className="text-xs sm:text-sm font-medium text-[#6B5344] hover:text-[#A97B45] transition-colors duration-200">
                  Terms &amp; Conditions
                </Link>
              </li>
              <li>
                <Link to="/privacy-policy" className="text-xs sm:text-sm font-medium text-[#6B5344] hover:text-[#A97B45] transition-colors duration-200">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/refund-policy" className="text-xs sm:text-sm font-medium text-[#6B5344] hover:text-[#A97B45] transition-colors duration-200">
                  Refund Policy
                </Link>
              </li>
              <li>
                <Link to="/shipping-policy" className="text-xs sm:text-sm font-medium text-[#6B5344] hover:text-[#A97B45] transition-colors duration-200">
                  Shipping Policy
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Section */}
          <div>
            <h3 className="font-semibold text-xs uppercase tracking-widest text-[#7A5A45] mb-6 pb-3 border-b border-[#E2CBA6]">
              Contact Concierge
            </h3>
            <ul className="space-y-4 text-xs sm:text-sm text-[#6B5344]">
              <li className="flex items-start gap-3 group">
                <MapPin className="w-4 h-4 text-[#A97B45] shrink-0 mt-0.5 transition-colors" />
                <span className="font-medium">{address}</span>
              </li>
              <li className="flex items-center gap-3 group">
                <Phone className="w-4 h-4 text-[#A97B45] shrink-0 transition-colors" />
                <a href={`tel:${phone}`} className="font-medium text-[#6B5344] hover:text-[#A97B45] transition-colors duration-200">
                  {phone}
                </a>
              </li>
              <li className="flex items-center gap-3 group">
                <Mail className="w-4 h-4 text-[#A97B45] shrink-0 transition-colors" />
                <a href={`mailto:${email}`} className="font-medium text-[#6B5344] hover:text-[#A97B45] transition-colors duration-200">
                  {email}
                </a>
              </li>
              <li className="flex items-center gap-3 group">
                <FacebookIcon className="w-4 h-4 text-[#A97B45] shrink-0 transition-colors" />
                <a
                  href="https://www.facebook.com/share/1BvRHytGeq/?mibextid=wwXIfr"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-[#6B5344] hover:text-[#A97B45] transition-colors duration-200"
                >
                  Follow on Facebook
                </a>
              </li>
              <li className="flex items-center gap-3 group">
                <InstagramIcon className="w-4 h-4 text-[#A97B45] shrink-0 transition-colors" />
                <a
                  href="https://www.instagram.com/madalsacouture?mdxt=MXNpcjZ5NDQ5MTh0NA=="
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-[#6B5344] hover:text-[#A97B45] transition-colors duration-200"
                >
                  Follow on Instagram
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="border-t border-[#E8DCC8] bg-gradient-to-r from-[#FEFBF7] to-[#FBF8F2]">
        <div className="max-w-7xl mx-auto px-6 py-6 lg:py-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Left */}
            <p className="text-xs font-medium text-[#8B6F5E]">
              Luxury craftsmanship, timeless design.
            </p>

            {/* Center */}
            <p className="text-xs text-[#8B6F5E]">
              © {new Date().getFullYear()} Madalsa Couture. All rights reserved.
            </p>

            {/* Right */}
            <a
              href="#top"
              onClick={scrollToTop}
              className="flex items-center gap-2 text-[#8B6F5E] hover:text-[#A97B45] text-xs font-semibold uppercase tracking-widest transition-all duration-300 group/top"
            >
              Back to Top
              <ArrowUp className="w-3.5 h-3.5 transition-transform duration-300 group-hover/top:-translate-y-1" />
            </a>
          </div>
        </div>
      </div>

      {/* Floating WhatsApp Contact Trigger */}
      <a
        href={`https://wa.me/${waNumber}`}
        target="_blank"
        rel="noreferrer"
        className="fixed right-6 bottom-6 z-50 inline-flex items-center justify-center rounded-full bg-white p-3 shadow-[0_15px_40px_rgba(0,0,0,0.12)] transition-transform hover:scale-110"
        aria-label="WhatsApp contact"
        title="WhatsApp Concierge"
      >
        <WhatsAppIcon className="w-6 h-6" />
      </a>
    </footer>
  );
};

export default Footer;
