import React, { useState, useEffect } from 'react';
import {
  Building2,
  Save,
  MapPin,
  Clock,
  Shield,
  Image as ImageIcon,
  Plus,
  Trash2,
  CheckCircle,
  ExternalLink,
} from 'lucide-react';
import { useManagerStore } from '../../store/managerStore';
import { toast } from 'sonner';

export const PropertyProfileView: React.FC = () => {
  const { currentHotelId, hotels, updateHotelProfile } = useManagerStore();
  const currentHotel = hotels.find((h) => h.id === currentHotelId) || hotels[0];

  // Local form state initialized with currentHotel
  const [name, setName] = useState(currentHotel.name);
  const [description, setDescription] = useState(currentHotel.description);
  const [starRating, setStarRating] = useState(currentHotel.starRating);
  const [address, setAddress] = useState(currentHotel.address);
  const [city, setCity] = useState(currentHotel.city);
  const [state, setState] = useState(currentHotel.state);
  const [country, setCountry] = useState(currentHotel.country);
  const [postalCode, setPostalCode] = useState(currentHotel.postalCode);
  const [latitude, setLatitude] = useState(currentHotel.latitude);
  const [longitude, setLongitude] = useState(currentHotel.longitude);
  const [phone, setPhone] = useState(currentHotel.phone);
  const [email, setEmail] = useState(currentHotel.email);
  const [checkInTime, setCheckInTime] = useState(currentHotel.checkInTime);
  const [checkOutTime, setCheckOutTime] = useState(currentHotel.checkOutTime);
  const [cancellationGraceHours, setCancellationGraceHours] = useState(
    currentHotel.cancellationGraceHours
  );
  const [images, setImages] = useState<string[]>(currentHotel.images);
  const [newImageUrl, setNewImageUrl] = useState('');

  // Sync if current hotel switches
  useEffect(() => {
    setName(currentHotel.name);
    setDescription(currentHotel.description);
    setStarRating(currentHotel.starRating);
    setAddress(currentHotel.address);
    setCity(currentHotel.city);
    setState(currentHotel.state);
    setCountry(currentHotel.country);
    setPostalCode(currentHotel.postalCode);
    setLatitude(currentHotel.latitude);
    setLongitude(currentHotel.longitude);
    setPhone(currentHotel.phone);
    setEmail(currentHotel.email);
    setCheckInTime(currentHotel.checkInTime);
    setCheckOutTime(currentHotel.checkOutTime);
    setCancellationGraceHours(currentHotel.cancellationGraceHours);
    setImages(currentHotel.images);
  }, [currentHotel]);

  const handleAddImage = () => {
    if (!newImageUrl.trim()) return;
    setImages([...images, newImageUrl.trim()]);
    setNewImageUrl('');
  };

  const handleRemoveImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    updateHotelProfile({
      name: name.trim(),
      description: description.trim(),
      starRating: Number(starRating),
      address: address.trim(),
      city: city.trim(),
      state: state.trim(),
      country: country.trim(),
      postalCode: postalCode.trim(),
      latitude: Number(latitude),
      longitude: Number(longitude),
      phone: phone.trim(),
      email: email.trim(),
      checkInTime,
      checkOutTime,
      cancellationGraceHours: Number(cancellationGraceHours),
      images,
    });

    toast.success(`Hotel Profile "${name}" Saved Successfully!`, {
      description: `Cache keys (cache:hotels:detail:${currentHotel.id}) invalidated in Redis. Public changes live.`,
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-border/80">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground font-serif">
              Property Configuration & Policies
            </h1>
            <span className="text-xs px-2.5 py-0.5 font-bold rounded-full bg-brand-100 text-brand-900 dark:bg-brand-950 dark:text-brand-300">
              Scattered Multi-Tenant Auth
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Manage metadata, coordinates, front-desk arrival policies, and visual galleries for {currentHotel.name}.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-brand-800 text-xs font-semibold shadow-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Save size={14} />
          <span>Save Property Changes</span>
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-6 text-xs">
        {/* 1. General Profile & Contact */}
        <div className="p-5 rounded-xl border border-border bg-card shadow-subtle space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <Building2 size={16} className="text-primary" />
            <h2 className="text-sm font-bold text-foreground">General Hotel Profile</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-foreground font-semibold mb-1">
                Hotel Legal Establishment Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label className="block text-foreground font-semibold mb-1">
                Star Classification Rating *
              </label>
              <select
                value={starRating}
                onChange={(e) => setStarRating(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value={3}>3 Stars (Boutique / Comfort)</option>
                <option value={4}>4 Stars (First Class)</option>
                <option value={5}>5 Stars (Luxury Sanctuary)</option>
              </select>
            </div>

            <div className="sm:col-span-3">
              <label className="block text-foreground font-semibold mb-1">
                Property Overview & Sanctuary Description
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label className="block text-foreground font-semibold mb-1">
                Front-Desk Telephone *
              </label>
              <input
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-foreground font-semibold mb-1">
                Operational Email Address *
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        </div>

        {/* 2. Physical Address & Coordinates */}
        <div className="p-5 rounded-xl border border-border bg-card shadow-subtle space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <MapPin size={16} className="text-primary" />
            <h2 className="text-sm font-bold text-foreground">Physical Address & Location Coordinates</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-3">
              <label className="block text-foreground font-semibold mb-1">Street Address *</label>
              <input
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label className="block text-foreground font-semibold mb-1">City *</label>
              <input
                type="text"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label className="block text-foreground font-semibold mb-1">State / Province *</label>
              <input
                type="text"
                required
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label className="block text-foreground font-semibold mb-1">Postal Code *</label>
              <input
                type="text"
                required
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label className="block text-foreground font-semibold mb-1">Latitude</label>
              <input
                type="number"
                step="any"
                value={latitude}
                onChange={(e) => setLatitude(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label className="block text-foreground font-semibold mb-1">Longitude</label>
              <input
                type="number"
                step="any"
                value={longitude}
                onChange={(e) => setLongitude(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label className="block text-foreground font-semibold mb-1">Country</label>
              <input
                type="text"
                disabled
                value={country}
                className="w-full px-3 py-2 rounded-lg border border-border bg-muted/60 text-muted-foreground text-xs cursor-not-allowed"
              />
            </div>
          </div>
        </div>

        {/* 3. Operational Timings & Cancellation Policy */}
        <div className="p-5 rounded-xl border border-border bg-card shadow-subtle space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <Clock size={16} className="text-primary" />
            <h2 className="text-sm font-bold text-foreground">Operational Check-in Timings & Cancellation Policy</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-foreground font-semibold mb-1">
                Standard Check-In Time *
              </label>
              <input
                type="time"
                required
                value={checkInTime}
                onChange={(e) => setCheckInTime(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label className="block text-foreground font-semibold mb-1">
                Standard Check-Out Time *
              </label>
              <input
                type="time"
                required
                value={checkOutTime}
                onChange={(e) => setCheckOutTime(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label className="block text-foreground font-semibold mb-1">
                Free Cancellation Grace Window (Hours) *
              </label>
              <input
                type="number"
                min={0}
                max={168}
                required
                value={cancellationGraceHours}
                onChange={(e) => setCancellationGraceHours(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <span className="text-[11px] text-muted-foreground mt-0.5 block">
                Cancellations within {cancellationGraceHours}h incur 1-night policy charge.
              </span>
            </div>
          </div>
        </div>

        {/* 4. Visual Media Photography Gallery */}
        <div className="p-5 rounded-xl border border-border bg-card shadow-subtle space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <ImageIcon size={16} className="text-primary" />
            <h2 className="text-sm font-bold text-foreground">Property Photography Gallery</h2>
          </div>

          <div className="flex gap-2">
            <input
              type="url"
              placeholder="Paste high-res image URL (Unsplash or CDN)..."
              value={newImageUrl}
              onChange={(e) => setNewImageUrl(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg border border-input bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-ring font-mono"
            />
            <button
              type="button"
              onClick={handleAddImage}
              className="px-3.5 py-2 rounded-lg bg-secondary text-secondary-foreground hover:bg-muted font-semibold transition-colors flex items-center gap-1"
            >
              <Plus size={14} />
              <span>Add Photo</span>
            </button>
          </div>

          {/* Grid of images */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {images.map((img, idx) => (
              <div
                key={idx}
                className="relative aspect-[16/10] rounded-lg overflow-hidden border border-border group bg-muted"
              >
                <img
                  src={img}
                  alt={`Hotel gallery ${idx + 1}`}
                  className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveImage(idx)}
                  className="absolute top-2 right-2 p-1.5 rounded-md bg-neutral-950/70 text-white opacity-0 group-hover:opacity-100 hover:bg-rose-600 transition-all"
                  title="Remove image"
                >
                  <Trash2 size={13} />
                </button>
                <span className="absolute bottom-1.5 left-2 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px] font-mono">
                  Photo #{idx + 1}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-brand-800 text-xs font-semibold shadow-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Save size={14} />
            <span>Save All Property Changes</span>
          </button>
        </div>
      </form>
    </div>
  );
};
