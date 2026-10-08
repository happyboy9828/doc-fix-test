'use client';
// src/pages/toolPage.js
import React, { useEffect, useRef } from 'react';
import { initMergePdfTool } from '../utility/mergePdf';
import '../utility/mergePdf.css';

export default function ToolPage() {
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current) {
      initMergePdfTool(containerRef.current);
    }
  }, []);

  return <div ref={containerRef}></div>;
}