import React, { useState } from 'react';
import { Building2, Plus, Sparkles, MapPin, Star, Image, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from '../../components/shared/Modal';
import { useAdminStore } from '../../store/adminStore';

export const OnboardHotelModal: React.FC = () => {
  const { isOnboardHotelModalOpen, setOnboardHotelModalOpen, addOnboardedHotel } = useAdminStore();

  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('Chennai');
  const [state, setState] = useState('Tamil Nadu');
  const [country, setCountry] = useState('India');
  const [address, setAddress] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [starRating, setStarRating] = useState<number>(5);
  const [basePrice, setBasePrice] = useState<number>(6500);
  const [totalRooms, setTotalRooms] = useState<number>(120);
  const [imageUrl, setImageUrl] = useState(
    'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80'
  );
  const [cancellationPolicy, setCancellationPolicy] = useState(
    'Free cancellation up to 24 hours prior to check-in. 100% first night charge thereafter.'
  );

  const availableAmenities = [
    'High-Speed WiFi',
    'Infinity Pool',
    'Serena Spa',
    'Valet Parking',
    'Fine Dining',
    'Fitness Center',
    'Airport Shuttle',
    '24/7 Concierge',
    'Private Beach',
    'Helipad',
  ];

  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([
    'High-Speed WiFi',
    'Infinity Pool',
    'Valet Parking',
    'Fine Dining',
  ]);

  const toggleAmenity = (amenity: string) => {
    if (selectedAmenities.includes(amenity)) {
      setSelectedAmenities(selectedAmenities.filter((a) => a !== amenity));
    } else {
      setSelectedAmenities([...selectedAmenities, amenity]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !address.trim()) {
      toast.error('Please enter property name and physical address.');
      return;
    }

    addOnboardedHotel({
      name,
      brand: brand || 'Independent Luxury',
      description: description || `${name} offers world-class hospitality in the heart of ${city}.`,
      city,
      state,
      country,
      address,
      postalCode: postalCode || '600001',
      latitude: 13.0827,
      longitude: 80.2707,
      starRating,
      amenities: selectedAmenities,
      images: [
        imageUrl,
        'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=800&q=80',
      ],
      status: 'ACTIVE',
      totalRooms: Number(totalRooms) || 50,
      cancellationPolicy,
      basePrice: Number(basePrice) || 5000,
    });

    toast.success(`Property "${name}" onboarded and published to inventory.`);
    setOnboardHotelModalOpen(false);

    // Reset Form
    setName('');
    setAddress('');
  };

  return (
    <Modal
      isOpen={isOnboardHotelModalOpen}
      onClose={() => setOnboardHotelModalOpen(false)}
      title="Onboard New Hotel Property (POST /api/v1/hotels)"
      subtitle="Superadmin Property Creation: Provisions new catalog entry and physical inventory matrix."
      size="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5 text-xs">
        {/* Basic Metadata */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-bold text-foreground mb-1">
              Hotel Name <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. The Oberoi Grand"
              className="w-full px-3 py-2 bg-background border border-input rounded-lg text-foreground focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="block font-bold text-foreground mb-1">Brand / Chain Classification</label>
            <input
              type="text"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="e.g. Oberoi Hotels, Marriott, Taj, Independent"
              className="w-full px-3 py-2 bg-background border border-input rounded-lg text-foreground focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block font-bold text-foreground mb-1">Editorial Description</label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the hotel aesthetic, sanctuary features, and unique attractions..."
            className="w-full px-3 py-2 bg-background border border-input rounded-lg text-foreground focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Location Specs */}
        <div className="p-4 bg-muted/40 rounded-xl border border-border space-y-3">
          <div className="font-bold text-foreground flex items-center gap-1.5">
            <MapPin size={14} className="text-primary" />
            <span>Geographic & Address Information</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-muted-foreground mb-1">City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3 py-1.5 bg-background border border-input rounded-lg text-foreground"
              />
            </div>
            <div>
              <label className="block text-muted-foreground mb-1">State / Province</label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full px-3 py-1.5 bg-background border border-input rounded-lg text-foreground"
              />
            </div>
            <div>
              <label className="block text-muted-foreground mb-1">Postal Code</label>
              <input
                type="text"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder="600001"
                className="w-full px-3 py-1.5 bg-background border border-input rounded-lg text-foreground"
              />
            </div>
          </div>

          <div>
            <label className="block text-muted-foreground mb-1">Street Address</label>
            <input
              type="text"
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. 15 Esplanade Row, Guindy"
              className="w-full px-3 py-1.5 bg-background border border-input rounded-lg text-foreground"
            />
          </div>
        </div>

        {/* Operational & Pricing Parameters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block font-bold text-foreground mb-1">Star Classification</label>
            <select
              value={starRating}
              onChange={(e) => setStarRating(Number(e.target.value))}
              className="w-full px-3 py-2 bg-background border border-input rounded-lg text-foreground font-semibold"
            >
              <option value={5}>★★★★★ (5 Stars - Luxury)</option>
              <option value={4}>★★★★ (4 Stars - Premium)</option>
              <option value={3}>★★★ (3 Stars - Boutique)</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-foreground mb-1">Starting Base Rate (₹)</label>
            <input
              type="number"
              min={1000}
              step={500}
              value={basePrice}
              onChange={(e) => setBasePrice(Number(e.target.value))}
              className="w-full px-3 py-2 bg-background border border-input rounded-lg text-foreground font-mono"
            />
          </div>

          <div>
            <label className="block font-bold text-foreground mb-1">Total Physical Units</label>
            <input
              type="number"
              min={1}
              value={totalRooms}
              onChange={(e) => setTotalRooms(Number(e.target.value))}
              className="w-full px-3 py-2 bg-background border border-input rounded-lg text-foreground font-mono"
            />
          </div>
        </div>

        {/* Amenities Selection */}
        <div>
          <label className="block font-bold text-foreground mb-2">Property Amenities Strip</label>
          <div className="flex flex-wrap gap-2">
            {availableAmenities.map((amenity) => {
              const isSelected = selectedAmenities.includes(amenity);
              return (
                <button
                  key={amenity}
                  type="button"
                  onClick={() => toggleAmenity(amenity)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    isSelected
                      ? 'bg-primary text-primary-foreground border-primary font-bold'
                      : 'bg-muted/60 text-muted-foreground border-border hover:bg-muted'
                  }`}
                >
                  {isSelected ? `✓ ${amenity}` : `+ ${amenity}`}
                </button>
              );
            })}
          </div>
        </div>

        {/* Image Photography URL */}
        <div>
          <label className="block font-bold text-foreground mb-1">Featured High-Res Photography URL</label>
          <input
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            className="w-full px-3 py-2 bg-background border border-input rounded-lg text-foreground font-mono"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <button
            type="button"
            onClick={() => setOnboardHotelModalOpen(false)}
            className="px-4 py-2 border border-border rounded-lg text-foreground hover:bg-muted font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg font-bold transition-all shadow-sm flex items-center gap-1.5"
          >
            <ShieldCheck size={16} className="text-teal-300" />
            <span>Publish Property to Inventory</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
