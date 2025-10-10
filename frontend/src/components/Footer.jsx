import React from 'react';
import './Footer.css';
import { APP_COMPANY } from '../constants';
import { APP_VERSION } from '../constants'; 


export default function Footer() {
  return (
    <footer className="app-footer">
      <div className="footer-content">
        <div>{APP_COMPANY} © {new Date().getFullYear()}</div>
        <div className="footer-right">v{APP_VERSION}</div>
      </div>
    </footer>
  );
}
