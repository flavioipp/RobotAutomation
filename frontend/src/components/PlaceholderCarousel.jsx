import React, { useEffect, useState, useMemo } from 'react';
import IconButton from '@mui/material/IconButton';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import './PlaceholderCarousel.css';

function makeSvgDataUrl(number, width = 800, height = 400, bg = '#ddd', fg = '#333') {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}' viewBox='0 0 ${width} ${height}'>`+
    `<rect width='100%' height='100%' fill='${bg}' />`+
    `<text x='50%' y='50%' font-family='Arial, Helvetica, sans-serif' font-size='120' fill='${fg}' dominant-baseline='middle' text-anchor='middle'>${number}</text>`+
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export default function PlaceholderCarousel({ interval = 3000 }) {
  const images = useMemo(() => [1,2,3,4,5].map(n => makeSvgDataUrl(n)), []);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIndex(i => (i + 1) % images.length), interval);
    return () => clearInterval(t);
  }, [images.length, interval]);

  const prev = () => setIndex(i => (i - 1 + images.length) % images.length);
  const next = () => setIndex(i => (i + 1) % images.length);

  return (
    <div className="placeholder-carousel">
      <div className="carousel-frame">
        <img src={images[index]} alt={`placeholder ${index+1}`} className="carousel-image" />
        <div className="carousel-controls">
          <IconButton size="small" onClick={prev} aria-label="previous">
            <ArrowBackIosNewIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={next} aria-label="next">
            <ArrowForwardIosIcon fontSize="small" />
          </IconButton>
        </div>
      </div>
      <div className="carousel-dots">
        {images.map((_, i) => (
          <button key={i} className={`dot ${i === index ? 'active' : ''}`} onClick={() => setIndex(i)} aria-label={`Go to ${i+1}`} />
        ))}
      </div>
    </div>
  );
}
