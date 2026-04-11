"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useTheme } from "@/lib/theme";

const navItems = [
  { href: "/", label: "Quay Số", icon: "🏓" },
  { href: "/bracket", label: "Nhánh Đấu", icon: "🏆" },
];

export default function Navbar() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  return (
    <motion.nav
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="fixed top-0 left-0 right-0 z-50 backdrop-blur-2xl"
      style={{
        background: "var(--bg-glass)",
        borderBottom: "1px solid var(--bg-glass-border)",
      }}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2 sm:gap-3 group">
          <motion.span
            className="text-xl sm:text-2xl"
            animate={{ rotateY: 360 }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          >
            🏓
          </motion.span>
          <span className="text-sm sm:text-lg font-extrabold tracking-wider text-shimmer">
            PICKLEBALL OPEN
          </span>
        </Link>

        {/* Nav Links + Theme Toggle */}
        <div className="flex items-center gap-1 sm:gap-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-semibold transition-all duration-300"
                style={{
                  color: isActive ? "var(--gold)" : "var(--btn-inactive-text)",
                  background: isActive ? "var(--bg-hover)" : "transparent",
                }}
              >
                <span>{item.icon}</span>
                <span className="hidden xs:inline sm:inline">{item.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 rounded-full"
                    style={{ border: "1px solid var(--gold)", opacity: 0.4 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
              </Link>
            );
          })}

          {/* Theme Toggle */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={toggleTheme}
            className="ml-1 sm:ml-2 w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all"
            style={{
              background: "var(--bg-hover)",
              border: "1px solid var(--bg-glass-border)",
            }}
            title={theme === "dark" ? "Chuyển sáng" : "Chuyển tối"}
          >
            <motion.span
              key={theme}
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 300 }}
              className="text-sm sm:text-base"
            >
              {theme === "dark" ? "☀️" : "🌙"}
            </motion.span>
          </motion.button>
        </div>
      </div>
    </motion.nav>
  );
}
