import React, { useEffect, useRef } from 'react';
import { initHtmlToDocx } from '../utility/tool';
import '../utility/tool.css';

export default function ToolPage() {
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current) {
      initHtmlToDocx(containerRef.current);
    }
  }, []);

  return <div ref={containerRef}></div>;
}