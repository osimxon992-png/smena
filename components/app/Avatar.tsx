// Dumaloq rasm; rasm bo'lmasa ismning bosh harflari
const Avatar = ({ photo, name, className = '' }: { photo: string | null; name: string; className?: string }) => (
  <span className={`avatar ${className}`} aria-hidden="true">
    {photo ? <img src={photo} alt="" /> : name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
  </span>
);

export default Avatar;
