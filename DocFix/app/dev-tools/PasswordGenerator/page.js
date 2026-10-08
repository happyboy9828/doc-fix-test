"use client";

import { useEffect, useRef } from "react";
import { initPasswordGenerator } from "../../../utils/dev-tools/PasswordGenerator/PasswordGenerator";
import "../../../utils/dev-tools/PasswordGenerator/PasswordGenerator.css";

export default function PasswordGeneratorPage() {
  const ref = useRef(null);

  useEffect(() => {
    const destroy = initPasswordGenerator(ref.current);
    return destroy;
  }, []);

  return <div ref={ref} className="tool-page" />;
}
