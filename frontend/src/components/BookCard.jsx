import StarRating from "./StarRating";

const BookCard = ({ book, onClick, onRemove, showStatus = false, showAverageRating = true }) => {
  const statusColors = {
    want_to_read: { bg: "#FEF3C7", text: "#92400E", label: "Want to read" },
    reading: { bg: "#DBEAFE", text: "#1E40AF", label: "Reading" },
    read: { bg: "#D1FAE5", text: "#065F46", label: "Read" },
  };

  const status = book.status ? statusColors[book.status] : null;
  
  // Use averageRating for search/browse, rating for user's personal books
  const displayRating = showAverageRating 
    ? (book.averageRating || book.average_rating || 0)
    : (book.rating || 0);
  
  const hasRatingCount = book.ratingCount > 0 || book.rating_count > 0;
  const ratingCount = book.ratingCount || parseInt(book.rating_count, 10) || 0;

  return (
    <div className="group cursor-pointer" onClick={() => onClick?.(book)}>
      {/* Cover Image */}
      <div className="relative aspect-[3/4] rounded-lg overflow-hidden mb-3 bg-gray-100 border border-gray-200 transition-all group-hover:shadow-lg group-hover:-translate-y-1">
        {book.coverUrl ? (
          <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center p-4"
            style={{ backgroundColor: "#E8D5B7" }}
          >
            <span
              className="text-sm font-semibold text-center"
              style={{ color: "#5C4E35", fontFamily: "'Playfair Display', serif" }}
            >
              {book.title}
            </span>
          </div>
        )}

        {/* Status badge */}
        {showStatus && status && (
          <div
            className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-xs font-medium"
            style={{ backgroundColor: status.bg, color: status.text }}
          >
            {status.label}
          </div>
        )}

        {/* Remove button */}
        {onRemove && (
          <button
            onClick={e => { e.stopPropagation(); onRemove(book) }}
            className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white/80 hover:bg-red-500 hover:text-white text-gray-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all text-sm font-bold leading-none"
            title="Remove from shelf"
          >
            ×
          </button>
        )}
      </div>

      {/* Book Info */}
      <h3 className="text-sm font-semibold truncate" style={{ color: "#1C1C1C" }}>
        {book.title}
      </h3>
      <p className="text-xs text-gray-500 mb-1">{book.author}</p>
      <div className="flex items-center gap-1">
        <StarRating rating={displayRating} size={12} />
        {showAverageRating && hasRatingCount && (
          <span className="text-xs text-gray-400">({ratingCount})</span>
        )}
      </div>
      {book.review && (
        <p className="text-xs text-gray-400 mt-1 line-clamp-2 italic">"{book.review}"</p>
      )}
    </div>
  );
};

export default BookCard;
