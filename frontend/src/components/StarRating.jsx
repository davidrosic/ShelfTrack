const StarRating = ({ rating = 0, size = 14, interactive = false, onChange }) => {
  const stars = [1, 2, 3, 4, 5];

  return (
    <div className="flex gap-0.5">
      {stars.map((star) => (
        <svg
          key={star}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill={star <= rating ? "#D4A574" : "none"}
          stroke="#D4A574"
          strokeWidth="2"
          className={interactive ? "cursor-pointer hover:scale-110 transition-transform" : ""}
          onClick={() => interactive && onChange?.(star)}
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </div>
  );
};

export default StarRating;
