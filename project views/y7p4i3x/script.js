import { animate, stagger } from 'https://esm.run/framer-motion';

document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    initHeaderScroll();
    initScrollToTop();
    initScrollAnimations();
});

function initHeaderScroll() {
    const header = document.getElementById('main-header');
    if (!header) return;

    const handleScroll = () => {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll();
}

function initScrollToTop() {
    const button = document.getElementById('scroll-to-top');
    if (!button) return;

    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
            button.classList.add('visible');
        } else {
            button.classList.remove('visible');
        }
    });

    button.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

function initScrollAnimations() {
    const animatedElements = document.querySelectorAll('.anim-fade-in-up');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animate(
                    entry.target,
                    { opacity: 1, y: 0 },
                    { duration: 0.8, ease: 'easeOut' }
                );
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1
    });

    animatedElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        observer.observe(el);
    });
}
