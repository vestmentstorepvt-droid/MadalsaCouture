import React from 'react';

const ReviewsAndRatings: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 p-6 flex items-center justify-center">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 text-center max-w-md">
        <div className="text-4xl mb-4">⭐</div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Reviews Not Yet Available</h2>
        <p className="text-slate-500 text-sm">
          The reviews and ratings feature is not yet available from the backend. It will be wired up in a future update.
        </p>
      </div>
    </div>
  );
};

export default ReviewsAndRatings;
