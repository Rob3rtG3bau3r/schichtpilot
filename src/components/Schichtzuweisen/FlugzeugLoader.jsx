import { motion, useAnimation } from 'framer-motion';
import { useEffect } from 'react';

const FlugzeugLoader = () => {
  const controls = useAnimation();

  useEffect(() => {
    const animatePlane = async () => {
      while (true) {
        await controls.start({
          x: ['0vw', '80vw'],
          rotate: [0, 0],
          transition: {
            duration: 5,
            ease: 'easeInOut',
          },
        });
        await controls.set({ x: '-10vw' }); // Zurückspringen links ohne Sicht
      }
    };
    animatePlane();
  }, [controls]);

  return (
    <div className="relative h18S w-full overflow-hidden">
      {/* Flugzeug */}
      <motion.div
        animate={controls}
        className="absolute top-4"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 32 32"
          fill="currentColor"
          className="w-10 h-10 text-gray-300"
        >
          <path d="M0,16l2,2h12l-2,8h2l6-8h8c4,0,4-2,4-2c0-2-4-2-4-2c-10,0-8,0-8,0l-6-8h-2l2,8H4l-2-4H0V16z" />
        </svg>
      </motion.div>
    </div>
  );
};

export default FlugzeugLoader;
