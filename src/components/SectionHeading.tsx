import { motion } from "framer-motion";

export default function SectionHeading({
  index,
  eyebrow,
  title,
  body,
}: {
  index: string;
  eyebrow: string;
  title: string;
  body?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="mb-12 md:mb-16"
    >
      <div className="flex items-center gap-3 mb-5">
        <span className="font-mono text-[11px] text-mint tracking-[0.25em]">
          {index}
        </span>
        <span className="h-px w-10 bg-edge2" />
        <span className="font-mono text-[11px] text-faint tracking-[0.25em] uppercase">
          {eyebrow}
        </span>
      </div>
      <h2 className="text-3xl md:text-5xl font-medium tracking-tight leading-[1.05] max-w-3xl">
        {title}
      </h2>
      {body && (
        <p className="mt-5 max-w-xl text-dim leading-relaxed text-[15px]">{body}</p>
      )}
    </motion.div>
  );
}
