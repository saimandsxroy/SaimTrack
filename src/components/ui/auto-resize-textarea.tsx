"use client";

import React, { useEffect, useRef } from "react";

interface AutoResizeTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  minHeight?: number;
}

export function AutoResizeTextarea({ minHeight = 200, className = "", ...props }: AutoResizeTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resize = () => {
    if (textareaRef.current) {
      // Reset height to auto to correctly measure scrollHeight down
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.max(textareaRef.current.scrollHeight, minHeight)}px`;
    }
  };

  useEffect(() => {
    resize();
  }, [props.value]);

  return (
    <textarea
      ref={textareaRef}
      onChange={(e) => {
        resize();
        if (props.onChange) {
          props.onChange(e);
        }
      }}
      className={`w-full bg-transparent border-none outline-none resize-none overflow-hidden placeholder:text-text-tertiary text-text-primary ${className}`}
      style={{ minHeight }}
      {...props}
    />
  );
}
