"use strict";

    document.addEventListener("DOMContentLoaded", () => {
      const menuToggle = document.getElementById("menuToggle");
      const siteNav = document.getElementById("siteNav");
      const year = document.getElementById("year");
      const revealItems = document.querySelectorAll(".reveal");

      if (year) {
        year.textContent = new Date().getFullYear();
      }

      const closeMenu = () => {
        if (!menuToggle || !siteNav) return;
        menuToggle.classList.remove("active");
        siteNav.classList.remove("open");
        document.body.classList.remove("menu-open");
        menuToggle.setAttribute("aria-expanded", "false");
        menuToggle.setAttribute("aria-label", "Open menu");
      };

      const openMenu = () => {
        if (!menuToggle || !siteNav) return;
        menuToggle.classList.add("active");
        siteNav.classList.add("open");
        document.body.classList.add("menu-open");
        menuToggle.setAttribute("aria-expanded", "true");
        menuToggle.setAttribute("aria-label", "Close menu");
      };

      if (menuToggle && siteNav) {
        menuToggle.addEventListener("click", () => {
          siteNav.classList.contains("open") ? closeMenu() : openMenu();
        });

        siteNav.querySelectorAll("a").forEach((link) => {
          link.addEventListener("click", closeMenu);
        });

        window.addEventListener("resize", () => {
          if (window.innerWidth > 820) closeMenu();
        });

        document.addEventListener("keydown", (event) => {
          if (event.key === "Escape") closeMenu();
        });
      }

      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (reducedMotion || !("IntersectionObserver" in window)) {
        revealItems.forEach((item) => item.classList.add("visible"));
      } else {
        const observer = new IntersectionObserver((entries, activeObserver) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("visible");
            activeObserver.unobserve(entry.target);
          });
        }, {
          threshold: .12,
          rootMargin: "0px 0px -55px 0px"
        });

        revealItems.forEach((item, index) => {
          item.style.transitionDelay = `${Math.min(index % 4, 3) * 65}ms`;
          observer.observe(item);
        });
      }

      document.querySelectorAll('a[href^="#"]').forEach((link) => {
        link.addEventListener("click", (event) => {
          const id = link.getAttribute("href");

          if (!id || id === "#") {
            event.preventDefault();
            return;
          }

          const target = document.querySelector(id);
          if (!target) return;

          event.preventDefault();
          target.scrollIntoView({
            behavior: "smooth",
            block: "start"
          });
        });
      });
    });

document.addEventListener("DOMContentLoaded", () => {
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const finePointer = window.matchMedia("(pointer: fine)").matches;

      const loader = document.getElementById("pageLoader");
      const progress = document.getElementById("scrollProgress");
      const dot = document.getElementById("cursorDot");
      const ring = document.getElementById("cursorRing");

      window.addEventListener("load", () => {
        window.setTimeout(() => {
          loader?.classList.add("is-loaded");
        }, 350);
      });

      const updateProgress = () => {
        if (!progress) return;
        const scrollable = document.documentElement.scrollHeight - window.innerHeight;
        const percentage = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0;
        progress.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
      };

      updateProgress();
      window.addEventListener("scroll", updateProgress, { passive: true });
      window.addEventListener("resize", updateProgress);

      if (finePointer && !reducedMotion && dot && ring) {
        let mouseX = window.innerWidth / 2;
        let mouseY = window.innerHeight / 2;
        let ringX = mouseX;
        let ringY = mouseY;

        document.body.classList.add("cursor-ready");

        window.addEventListener("mousemove", (event) => {
          mouseX = event.clientX;
          mouseY = event.clientY;
          dot.style.transform = `translate(${mouseX}px, ${mouseY}px) translate(-50%, -50%)`;
        });

        const animateCursor = () => {
          ringX += (mouseX - ringX) * .16;
          ringY += (mouseY - ringY) * .16;
          ring.style.transform = `translate(${ringX}px, ${ringY}px) translate(-50%, -50%)`;
          requestAnimationFrame(animateCursor);
        };

        animateCursor();

        document.querySelectorAll("a, button, input, textarea, .service-card, .project-card, .client-card").forEach((element) => {
          element.addEventListener("mouseenter", () => document.body.classList.add("cursor-hover"));
          element.addEventListener("mouseleave", () => document.body.classList.remove("cursor-hover"));
        });

        window.addEventListener("mousedown", () => document.body.classList.add("cursor-click"));
        window.addEventListener("mouseup", () => document.body.classList.remove("cursor-click"));
      }

      if (!reducedMotion) {
        const hero = document.querySelector(".hero");
        const heroPoster = document.querySelector(".hero-poster");
        const stampOne = document.querySelector(".stamp-one");
        const stampTwo = document.querySelector(".stamp-two");

        hero?.addEventListener("mousemove", (event) => {
          if (window.innerWidth <= 820) return;

          const bounds = hero.getBoundingClientRect();
          const x = (event.clientX - bounds.left) / bounds.width - .5;
          const y = (event.clientY - bounds.top) / bounds.height - .5;

          if (heroPoster) {
            heroPoster.style.translate = `${x * 18}px ${y * 12}px`;
          }

          if (stampOne) {
            stampOne.style.translate = `${x * -22}px ${y * -18}px`;
          }

          if (stampTwo) {
            stampTwo.style.translate = `${x * 16}px ${y * 14}px`;
          }
        });

        hero?.addEventListener("mouseleave", () => {
          if (heroPoster) heroPoster.style.translate = "";
          if (stampOne) stampOne.style.translate = "";
          if (stampTwo) stampTwo.style.translate = "";
        });

        document.querySelectorAll(".service-card, .project-card, .client-card, .process-card, .testimonial-card, .contact-card").forEach((card) => {
          card.classList.add("tilt-card");

          card.addEventListener("mousemove", (event) => {
            if (window.innerWidth <= 820) return;

            const rect = card.getBoundingClientRect();
            const x = (event.clientX - rect.left) / rect.width - .5;
            const y = (event.clientY - rect.top) / rect.height - .5;

            card.style.transform = `
              perspective(1000px)
              rotateX(${y * -5}deg)
              rotateY(${x * 7}deg)
              translateY(-5px)
            `;
          });

          card.addEventListener("mouseleave", () => {
            card.style.transform = "";
          });
        });

        document.querySelectorAll(".btn, .nav-cta").forEach((button) => {
          button.classList.add("magnetic");

          button.addEventListener("mousemove", (event) => {
            const rect = button.getBoundingClientRect();
            const x = event.clientX - rect.left - rect.width / 2;
            const y = event.clientY - rect.top - rect.height / 2;

            button.style.transform = `translate(${x * .16}px, ${y * .2}px)`;
          });

          button.addEventListener("mouseleave", () => {
            button.style.transform = "";
          });
        });
      }
    });

window.setTimeout(() => {
      document.querySelectorAll(".reveal").forEach((item) => {
        item.classList.add("visible");
      });
    }, 1400);

document.addEventListener("DOMContentLoaded", () => {
  const copyButton = document.querySelector("[data-copy-email]");
  const copyStatus = document.querySelector(".copy-status");

  copyButton?.addEventListener("click", async () => {
    const email = copyButton.dataset.copyEmail;

    try {
      await navigator.clipboard.writeText(email);
      copyButton.textContent = "Email copied ✓";
      if (copyStatus) copyStatus.textContent = email + " copied to clipboard";
    } catch {
      if (copyStatus) copyStatus.textContent = "Copy failed — email gestophilip@gmail.com directly";
    }

    window.setTimeout(() => {
      copyButton.textContent = "Copy email";
      if (copyStatus) copyStatus.textContent = "";
    }, 3000);
  });
});
