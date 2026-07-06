import React, { useState } from "react";
import Image from "next/image";
import { Loader2, ImageOff } from "lucide-react";

interface PlaceholderProps {
  className?: string;
}

export function ImageLoading({ className = "" }: Readonly<PlaceholderProps>) {
  return (
    <div
      className={`absolute inset-0 flex flex-col items-center justify-center bg-base-content/5 backdrop-blur-xs select-none border border-base-content/10 rounded-2xl animate-pulse ${className}`}
    >
      <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 text-user-accent animate-spin mb-1 sm:mb-2" />
      <span className="text-[10px] sm:text-xs font-mono font-medium tracking-wide text-base-content/50 uppercase">
        Loading...
      </span>
    </div>
  );
}

export function ImageNotFound({ className = "" }: Readonly<PlaceholderProps>) {
  return (
    <div
      className={`absolute inset-0 flex flex-col items-center justify-center bg-base-content/5 backdrop-blur-sm select-none border border-base-content/10 rounded-2xl glass-card ${className}`}
    >
      <ImageOff className="w-6 h-6 sm:w-8 sm:h-8 text-error/85 mb-1 sm:mb-2" />
      <span className="text-[10px] sm:text-xs font-mono font-medium tracking-wide text-error/80 uppercase">
        Not Found
      </span>
    </div>
  );
}

interface SafeImageProps {
  src: string;
  alt: string;
  fill?: boolean;
  sizes?: string;
  className?: string;
}

export function SafeImage({
  src,
  alt,
  fill = true,
  sizes,
  className = "",
}: Readonly<SafeImageProps>) {
  const [prevSrc, setPrevSrc] = useState(src);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  // If the src changes, reset states synchronously during render
  if (src !== prevSrc) {
    setPrevSrc(src);
    setIsLoading(true);
    setIsError(false);
  }

  return (
    <div className="relative w-full h-full">
      {isLoading && !isError && <ImageLoading />}
      {isError && <ImageNotFound />}
      {!isError && (
        <Image
          src={src}
          alt={alt}
          fill={fill}
          sizes={sizes}
          className={className}
          onLoad={() => setIsLoading(false)}
          onError={() => {
            setIsError(true);
            setIsLoading(false);
          }}
        />
      )}
    </div>
  );
}
