"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const header = document.getElementById("site-header");
  const menuToggle = document.getElementById("menu-toggle");
  const navigation = document.getElementById("site-navigation");
  const navigationLinks = navigation
    ? navigation.querySelectorAll("a")
    : [];

  const currentYear = document.getElementById("current-year");
  const revealElements = document.querySelectorAll(".reveal");

  if (currentYear) {
    currentYear.textContent = new Date().getFullYear().toString();
  }

  const updateHeader = () => {
    if (!header) {
      return;
    }

    header.classList.toggle("is-scrolled", window.scrollY > 20);
  };

  updateHeader();

  window.addEventListener("scroll", updateHeader, {
    passive: true
  });

  const closeMenu = () => {
    if (!menuToggle || !navigation) {
      return;
    }

    menuToggle.classList.remove("is-active");
    navigation.classList.remove("is-open");
    document.body.classList.remove("menu-open");

    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Open menu");
  };

  const openMenu = () => {
    if (!menuToggle || !navigation) {
      return;
    }

    menuToggle.classList.add("is-active");
    navigation.classList.add("is-open");
    document.body.classList.add("menu-open");

    menuToggle.setAttribute("aria-expanded", "true");
    menuToggle.setAttribute("aria-label", "Close menu");
  };

  if (menuToggle && navigation) {
    menuToggle.addEventListener("click", () => {
      const isOpen = navigation.classList.contains("is-open");

      if (isOpen) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    navigationLinks.forEach((link) => {
      link.addEventListener("click", closeMenu);
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 900) {
        closeMenu();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeMenu();
      }
    });
  }

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  if (prefersReducedMotion || !("IntersectionObserver" in window)) {
    revealElements.forEach((element) => {
      element.classList.add("is-visible");
    });

    return;
  }

  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    {
      threshold: 0.12,
      rootMargin: "0px 0px -60px 0px"
    }
  );

  revealElements.forEach((element, index) => {
    element.style.transitionDelay = `${Math.min(index % 4, 3) * 70}ms`;
    revealObserver.observe(element);
  });

  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", (event) => {
      const targetId = anchor.getAttribute("href");

      if (!targetId || targetId === "#") {
        event.preventDefault();
        return;
      }

      const target = document.querySelector(targetId);

      if (!target) {
        return;
      }

      event.preventDefault();

      target.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });
  });
});
