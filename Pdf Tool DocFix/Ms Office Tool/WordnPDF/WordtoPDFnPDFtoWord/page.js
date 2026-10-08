import React, { useEffect, useRef } from 'react';
import { initWordPdfConverter } from '../utility/tool';
import '../utility/tool.css';

export default function ToolPage() {
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current) {
      initWordPdfConverter(containerRef.current);
    }
  }, []);

  return <div ref={containerRef} />;
}