import React, { useEffect, useState, useMemo } from 'react';
import IconButton from '@mui/material/IconButton';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import './PlaceholderCarousel.css';

// Import carousel images from assets
import c1 from '../assets/carousel/c1.jpg';
import c2 from '../assets/carousel/c2.jpg';
import c3 from '../assets/carousel/c3.jpg';
import c4 from '../assets/carousel/c4.jpg';
import c5 from '../assets/carousel/c5.jpg';

export default function PlaceholderCarousel({ interval = 3000 }) {
  const images = useMemo(() => [c1, c2, c3, c4, c5], []);
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
        {images.map((src, i) => (
          <img
            key={i}
            src={src}
            alt={`slide ${i+1}`}
            className={`carousel-image slide ${i === index ? 'active' : ''}`}
            aria-hidden={i === index ? 'false' : 'true'}
          />
        ))}
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
