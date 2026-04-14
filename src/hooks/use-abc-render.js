import { useRef, useEffect } from 'preact/hooks';
import abcjs from 'abcjs';

export function useAbcRender(abc, options = {}) {
  const ref = useRef();
  const visualObjRef = useRef(null);

  useEffect(() => {
    if (ref.current && abc) {
      visualObjRef.current = abcjs.renderAbc(ref.current, abc, {
        responsive: 'resize',
        add_classes: true,
        ...options,
      });
    }
  }, [abc, options.visualTranspose]);

  return { ref, visualObj: visualObjRef };
}
