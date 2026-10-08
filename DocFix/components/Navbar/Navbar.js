"use client";
import React, { useState, useEffect, useRef } from 'react';
import PricingModal from "../PricingModal/PricingModal";
import { useDownloadLimit } from "../../utils/shared/useDownloadLimit";
import './Navbar.css';

export default function Navbar() {
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);

  const [selectedTheme, setSelectedTheme] = useState('light');
  const [themeDropdownOpen, setThemeDropdownOpen] = useState(false);
  const themeDropdownRef = useRef(null);
  const downloadLimit = useDownloadLimit();

  const themeOptions = [
    { value: 'light', label: 'Light', icon: '☀️' },
    { value: 'dark', label: 'Dark', icon: '🌙' },
    { value: 'neon', label: 'Neon', icon: '⚡' },
  ];

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || document.documentElement.getAttribute('data-theme') || 'light';
    setSelectedTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', selectedTheme);
  }, [selectedTheme]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        themeDropdownOpen &&
        themeDropdownRef.current &&
        !themeDropdownRef.current.contains(e.target)
      ) {
        setThemeDropdownOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [themeDropdownOpen]);

  const shouldShowDropdown = (index) => {
    return activeDropdown === index;
  };

  const handleDropdownToggle = (index) => {
    setActiveDropdown(activeDropdown === index ? null : index);
  };

  const handleThemeChange = (theme) => {
    setSelectedTheme(theme);
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    setThemeDropdownOpen(false);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
    setThemeDropdownOpen(false);
    setActiveDropdown(null);
  };

  const openPricing = () => {
    setPricingOpen(true);
    closeMobileMenu();
  };

  const closePricing = () => {
    setPricingOpen(false);
  };

  const currentTheme = themeOptions.find((t) => t.value === selectedTheme) || themeOptions[0];

  const categories = [
    {
      name: 'Image Tools',
      tools: [
        { name: 'Background Remover', href: '/img/BGRemove' },
        { name: 'Favicon Generator', href: '/img/FavIcon' },
        { name: 'Image Resizer', href: '/img/ImageResizer' },
        { name: 'Image Compressor', href: '/img/ImgCompresser' },
        { name: 'Image to Base64', href: '/img/ImgToBase64' },
        { name: 'JPG to PNG', href: '/img/JpgToPng' },
        { name: 'PNG to JPG', href: '/img/PngToJpg' },
        { name: 'WebP to PNG', href: '/img/WebpToPng' },
        { name: 'Watermark', href: '/img/Watermark' },
      ],
    },
    { name: 'PDF Tools', tools: [] },
    { name: 'MS Office Tools', tools: [] },
    {
      name: 'Dev Tools',
      tools: [
        { name: 'CSS Minifier', href: '/dev-tools/CSSMinifier' },
        { name: 'HTML Minifier', href: '/dev-tools/HTMLMinifier' },
        { name: 'Password Generator', href: '/dev-tools/PasswordGenerator' },
        { name: 'QR Code Generator', href: '/dev-tools/QRCodeGenerator' },
        { name: 'QR Code Scanner', href: '/dev-tools/QRCodeScanner' },
      ],
    },
    { name: 'Text Tools', tools: [] },
  ];

  const navLinks = (
    <>
      {categories.map((category, index) => (
        <li key={index} className="nav-dropdown-container">
          <button className="nav-button" onClick={() => handleDropdownToggle(index)}>
            <span>{category.name}</span>
            <span>&#9662;</span>
          </button>
          {shouldShowDropdown(index) && (
            <ul className="dropdown-menu">
              {category.tools.length > 0 ? (
                category.tools.map((tool, toolIndex) => (
                  <li key={toolIndex}>
                    <a href={tool.href} onClick={closeMobileMenu}>{tool.name}</a>
                  </li>
                ))
              ) : (
                <li className="dropdown-under-build">Under Build</li>
              )}
            </ul>
          )}
        </li>
      ))}
    </>
  );

  const navActions = (
    <>
      <div className="download-limit-wrapper">
        <span
          className={`download-limit-indicator${downloadLimit.remaining === 0 ? " is-limit-reached" : ""}`}
          aria-label={`Downloads remaining: ${downloadLimit.remaining} of ${downloadLimit.limit}`}
        >
          {downloadLimit.remaining > 0
            ? `${downloadLimit.remaining}/${downloadLimit.limit} downloads left`
            : 'Limit reached'}
        </span>
      </div>

      <div className={`theme-selector${themeDropdownOpen ? ' open' : ''}`} ref={themeDropdownRef}>
        <button
          className="theme-selector-btn"
          onClick={() => setThemeDropdownOpen(!themeDropdownOpen)}
          aria-haspopup="listbox"
          aria-expanded={themeDropdownOpen}
          aria-label="Select theme"
        >
          <span className="theme-icon">{currentTheme.icon}</span>
          <span className="theme-label">{currentTheme.label}</span>
          <span className="theme-chevron" aria-hidden="true"></span>
        </button>

        {themeDropdownOpen && (
          <ul className="theme-dropdown-menu" role="listbox">
            {themeOptions.map((theme) => (
              <li key={theme.value}>
                <button
                  className={`theme-option${selectedTheme === theme.value ? ' active' : ''}`}
                  onClick={() => handleThemeChange(theme.value)}
                >
                  <span className="theme-option-icon">{theme.icon}</span>
                  <span>{theme.label}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        className="pro-btn"
        aria-haspopup="dialog"
        aria-expanded={pricingOpen}
        onClick={openPricing}
      >
        <span className="pro-icon" aria-hidden="true">👑</span>
        <span>Get Pro</span>
      </button>
    </>
  );

  return (
    <>
      <nav className="navbar">
        <div className="navbar-logo">
          <a href="/">DocFix</a>
        </div>

        <ul className="navbar-links">
          {navLinks}
        </ul>

        <div className="navbar-actions">
          {navActions}
        </div>

        <button
          className={`hamburger ${mobileMenuOpen ? 'active' : ''}`}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle navigation"
          aria-expanded={mobileMenuOpen}
        >
          &#9776;
        </button>
      </nav>

      <div className={`mobile-menu ${mobileMenuOpen ? 'active' : ''}`} aria-hidden={!mobileMenuOpen}>
        <div className="overlay" onClick={closeMobileMenu} aria-hidden="true" />

        <aside className="drawer">
          <div className="drawer-header">
            <div className="navbar-logo">
              <a href="/">DocFix</a>
            </div>
            <button className="hamburger active" onClick={closeMobileMenu} aria-label="Close menu">
              &#10005;
            </button>
          </div>

          <div className="drawer-body">
            <ul className="navbar-links">
              {navLinks}
            </ul>

            <div className="navbar-actions">
              {navActions}
            </div>
          </div>
        </aside>
      </div>

      <PricingModal open={pricingOpen} onClose={closePricing} />
    </>
  );
}