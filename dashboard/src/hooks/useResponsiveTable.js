import { useEffect, useRef } from 'react';

// Custom hook to handle responsive table scrolling
const useResponsiveTable = () => {
  const tableRef = useRef(null);

  useEffect(() => {
    const tableContainer = tableRef.current;
    if (!tableContainer) return;

    const checkScroll = () => {
      const hasScroll = tableContainer.scrollWidth > tableContainer.clientWidth;
      if (hasScroll) {
        tableContainer.classList.add('has-scroll');
      } else {
        tableContainer.classList.remove('has-scroll');
      }
    };

    // Check on mount and when content changes
    checkScroll();

    // Check on window resize
    const handleResize = () => {
      setTimeout(checkScroll, 100);
    };

    window.addEventListener('resize', handleResize);

    // Observer to detect content changes
    const observer = new MutationObserver(checkScroll);
    observer.observe(tableContainer, { 
      childList: true, 
      subtree: true,
      attributes: false
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
    };
  }, []);

  return tableRef;
};

export default useResponsiveTable;
