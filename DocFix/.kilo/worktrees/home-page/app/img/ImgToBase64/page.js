"use client";

import { useEffect, useRef } from "react";
import { initImageToBase64 } from "../../../utils/img/ImgToBase64/ImgToBase64";
import "../../../utils/img/ImgToBase64/ImgToBase64.css";

export default function ImageToBase64Page() {
  const ref = useRef(null);

  useEffect(() => initImageToBase64(ref.current), []);

  return <div ref={ref} className="tool-page" />;
}