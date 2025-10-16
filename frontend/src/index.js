import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { BrowserRouter } from 'react-router-dom';
import "./index.css";
import { ToastProvider } from './components/ToastContext';

const container = document.getElementById("root");
const root = createRoot(container);

root.render(
	<React.StrictMode>
		<ToastProvider>
			<BrowserRouter>
				<App />
			</BrowserRouter>
		</ToastProvider>
	</React.StrictMode>
);
