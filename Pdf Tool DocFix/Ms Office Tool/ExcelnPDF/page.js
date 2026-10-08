import { useEffect, useRef } from 'react';
import { initExcelPdfConverter } from '../utility/tool';
import '../utility/tool.css';

export default function ToolPage() {
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current) {
      initExcelPdfConverter(containerRef.current);
    }
  }, []);

  return <div ref={containerRef}></div>;
}