'use client';
// src/pages/toolPage.js
import React, { useEffect, useRef } from 'react';
import { initRotatePdfTool } from '../utility/tool';
import '../utility/tool.css';

export default function ToolPage() {
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current) {
      initRotatePdfTool(containerRef.current);
    }
  }, []);

  return <div ref={containerRef} />;
}