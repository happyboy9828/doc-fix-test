'use client';
// src/pages/toolPage.js
import React, { useEffect, useRef } from 'react';
import { initPdfToJpgTool } from '../utility/tool';
import '../utility/tool.css';

export default function ToolPage() {
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current) {
      initPdfToJpgTool(containerRef.current);
    }
  }, []);

  return <div ref={containerRef} />;
}