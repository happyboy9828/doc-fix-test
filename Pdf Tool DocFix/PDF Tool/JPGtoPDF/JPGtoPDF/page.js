'use client';
// src/pages/toolPage.js
import React, { useEffect, useRef } from 'react';
import { initJpgToPdfTool } from '../utility/tool';
import '../utility/tool.css';

export default function ToolPage() {
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current) {
      initJpgToPdfTool(containerRef.current);
    }
  }, []);

  return <div ref={containerRef} />;
}