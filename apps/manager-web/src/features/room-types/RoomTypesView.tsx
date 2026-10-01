import React, { useState, useMemo } from 'react';
import {
  Layers,
  Plus,
  Users,
  Bed,
  Maximize2,
  Check,
  Edit3,
  DollarSign,
  Sparkles,
} from 'lucide-react';
import { useManagerStore } from '../../store/managerStore';
import { RoomType } from '../../types';
import { PriceDisplay } from '../../components/shared/PriceDisplay';
import { Modal } from '../../components/shared/Modal';
import { toast } from 'sonner';

const availableAmenitiesList = [
  'Free High-Speed Wi-Fi',
  'Ocean View',
  'Balcony',
  'Private Plunge Pool',
  'Club Lounge Access',
  'Executive Workstation',
  'Espresso Machine',
  'Marble Bath',
  'Deep Soaking Tub',
  '24/7 Room Service',
  'Smart TV 55"',
  'Safe Box',
  'Complimentary Breakfast',
  'Butler On-Call',
  'Outdoor Rain Shower',
  'Personal Bar',
  'Whirlpool Spa',
  'Private Elevator',
];

export const RoomTypesView: React.FC = () => {
  const {
    currentHotelId,
    hotels,
    roomTypes,
    rooms,
    updateRoomType,
    addRoomType,
  } = useManagerStore();

  const currentHotel = hotels.find((h) => h.id === currentHotelId) || hotels[0];
  const hotelRoomTypes = useMemo(
    () => roomTypes.filter((rt) => rt.hotelId === currentHotelId),
    [roomTypes, currentHotelId]
  );

  const [editingType, setEditingType] = useState<RoomType | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Form states for Create/Edit
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formMaxGuests, setFormMaxGuests] = useState(2);
  const [formBasePrice, setFormBasePrice] = useState(6500);
  const [formBedType, setFormBedType] = useState('1 King Bed');
  const [formSizeSqm, setFormSizeSqm] = useState(45);
  const [formAmenities, setFormAmenities] = useState<string[]>([]);
  const [formImageUrl, setFormImageUrl] = useState('');

  const openEditModal = (rt: RoomType) => {
    setEditingType(rt);
    setFormName(rt.name);
    setFormDescription(rt.description);
    setFormMaxGuests(rt.maxGuests);
    setFormBasePrice(rt.basePricePerNight);
    setFormBedType(rt.bedType);
    setFormSizeSqm(rt.sizeSqm);
    setFormAmenities(rt.amenities);
    setFormImageUrl(rt.images[0] || '');
  };

  const openCreateModal = () => {
    setEditingType(null);
    setFormName('');
    setFormDescription('');
    setFormMaxGuests(2);
    setFormBasePrice(7500);
    setFormBedType('1 King Bed');
    setFormSizeSqm(50);
    setFormAmenities(['Free High-Speed Wi-Fi', '24/7 Room Service', 'Smart TV 55"']);
    setFormImageUrl(
      'https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=800&q=80'
    );
    setIsCreateModalOpen(true);
  };

  const toggleAmenity = (amenity: string) => {
    if (formAmenities.includes(amenity)) {
      setFormAmenities(formAmenities.filter((a) => a !== amenity));
    } else {
      setFormAmenities([...formAmenities, amenity]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formName.trim()) {
      toast.error('Please specify a room category name.');
      return;
    }
    if (formBasePrice < 0) {
      toast.error('Base price cannot be negative.');
      return;
    }
    if (formMaxGuests < 1) {
      toast.error('Max guests must be at least 1.');
      return;
    }

    if (editingType) {
      updateRoomType({
        ...editingType,
        name: formName.trim(),
        description: formDescription.trim(),
        maxGuests: Number(formMaxGuests),
        basePricePerNight: Number(formBasePrice),
        bedType: formBedType,
        sizeSqm: Number(formSizeSqm),
        amenities: formAmenities,
        images: formImageUrl ? [formImageUrl] : editingType.images,
      });
      toast.success(`Room Type "${formName}" updated successfully.`);
      setEditingType(null);
    } else {
      addRoomType({
        hotelId: currentHotelId,
        name: formName.trim(),
        description: formDescription.trim(),
        maxGuests: Number(formMaxGuests),
        basePricePerNight: Number(formBasePrice),
        bedType: formBedType,
        sizeSqm: Number(formSizeSqm),
        amenities: formAmenities,
        images: [
          formImageUrl ||
            'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80',
        ],
        totalRoomsCount: 0,
      });
      toast.success(`New Room Category "${formName}" created!`);
      setIsCreateModalOpen(false);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-border/80">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground font-serif">
              Room Categories & Baseline Pricing
            </h1>
            <span className="text-xs px-2.5 py-0.5 font-bold rounded-full bg-brand-100 text-brand-900 dark:bg-brand-950 dark:text-brand-300">
              {hotelRoomTypes.length} Catalog SKUs
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Configure room types, commercial rates, bed setups, and guest amenities for {currentHotel.name}.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-brand-800 text-xs font-semibold shadow-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus size={14} />
          <span>Add New Category</span>
        </button>
      </div>

      {/* Catalog Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {hotelRoomTypes.map((rt) => {
          // Compute inventory stats for this room type
          const assignedRooms = rooms.filter((r) => r.roomTypeId === rt.id && r.hotelId === currentHotelId);
          const occupiedRooms = assignedRooms.filter((r) => r.operationalStatus === 'OCCUPIED');
          const availableRooms = assignedRooms.filter((r) => r.operationalStatus === 'AVAILABLE');

          return (
            <div
              key={rt.id}
              className="rounded-xl border border-border bg-card shadow-subtle overflow-hidden flex flex-col justify-between hover:border-brand-300 transition-colors"
            >
              <div>
                {/* Photo Header */}
                <div className="relative aspect-[16/8] w-full overflow-hidden bg-muted">
                  <img
                    src={rt.images[0]}
                    alt={rt.name}
                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />

                  <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between text-white">
                    <div>
                      <h3 className="text-base font-bold tracking-tight text-white drop-shadow-sm font-serif">
                        {rt.name}
                      </h3>
                      <div className="flex items-center gap-3 text-xs text-white/90 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Users size={12} />
                          <span>Max {rt.maxGuests} Guests</span>
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Bed size={12} />
                          <span>{rt.bedType}</span>
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Maximize2 size={12} />
                          <span>{rt.sizeSqm} m²</span>
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-white/80 block uppercase tracking-wider font-semibold">
                        Base Rate
                      </span>
                      <span className="text-lg font-bold text-white tabular-nums drop-shadow-sm">
                        ₹{rt.basePricePerNight.toLocaleString('en-IN')}
                      </span>
                      <span className="text-[10px] text-white/80 block">/ night</span>
                    </div>
                  </div>
                </div>

                {/* Description & Amenities */}
                <div className="p-4 space-y-3">
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                    {rt.description}
                  </p>

                  {/* Amenities Tags */}
                  <div>
                    <span className="text-[11px] font-semibold text-foreground uppercase tracking-wider block mb-1.5">
                      Included Room Amenities
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {rt.amenities.map((amenity) => (
                        <span
                          key={amenity}
                          className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-muted/80 text-foreground border border-border flex items-center gap-1"
                        >
                          <Check size={10} className="text-emerald-600 dark:text-emerald-400" />
                          <span>{amenity}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Inventory Ledger & Actions Footer */}
              <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-between">
                <div className="flex items-center gap-4 text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                      Inventory
                    </span>
                    <span className="font-bold text-foreground">
                      {assignedRooms.length} Physical Units
                    </span>
                  </div>
                  <div className="h-6 w-px bg-border" />
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                      Live Occupancy
                    </span>
                    <span className="font-bold text-sky-600 dark:text-sky-400">
                      {occupiedRooms.length} Booked ({availableRooms.length} Free)
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => openEditModal(rt)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card text-foreground hover:bg-muted font-semibold text-xs shadow-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Edit3 size={13} />
                  <span>Configure Rates & Specs</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Edit / Add Room Type */}
      {(editingType || isCreateModalOpen) && (
        <Modal
          isOpen={!!editingType || isCreateModalOpen}
          onClose={() => {
            setEditingType(null);
            setIsCreateModalOpen(false);
          }}
          title={editingType ? `Configure ${editingType.name}` : 'Create Room Category'}
          description="Update commercial baseline pricing, physical bed layout, capacity, and amenities."
          maxWidth="lg"
        >
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-foreground font-semibold mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Deluxe Sea View Suite"
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="block text-foreground font-semibold mb-1">
                  Base Price Per Night (₹) *
                </label>
                <input
                  type="number"
                  required
                  min={0}
                  step={500}
                  value={formBasePrice}
                  onChange={(e) => setFormBasePrice(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="block text-foreground font-semibold mb-1">
                  Maximum Guests Capacity *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={10}
                  value={formMaxGuests}
                  onChange={(e) => setFormMaxGuests(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="block text-foreground font-semibold mb-1">
                  Bed Configuration *
                </label>
                <input
                  type="text"
                  required
                  value={formBedType}
                  onChange={(e) => setFormBedType(e.target.value)}
                  placeholder="e.g. 1 King Bed or 2 Queen Beds"
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="block text-foreground font-semibold mb-1">
                  Room Size (m²) *
                </label>
                <input
                  type="number"
                  required
                  min={15}
                  max={500}
                  value={formSizeSqm}
                  onChange={(e) => setFormSizeSqm(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-foreground font-semibold mb-1">
                  Cover Photo URL
                </label>
                <input
                  type="url"
                  value={formImageUrl}
                  onChange={(e) => setFormImageUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-ring font-mono"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-foreground font-semibold mb-1">
                  Detailed Room Description
                </label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Highlight key design touches, bathroom features, and views..."
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            {/* Select Amenities */}
            <div>
              <label className="block text-foreground font-semibold mb-1.5">
                Toggle Amenities Included in this SKU
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto p-2 rounded-lg border border-border bg-muted/20">
                {availableAmenitiesList.map((amenity) => {
                  const isChecked = formAmenities.includes(amenity);
                  return (
                    <button
                      type="button"
                      key={amenity}
                      onClick={() => toggleAmenity(amenity)}
                      className={`text-left p-1.5 rounded text-[11px] font-medium border flex items-center gap-1.5 transition-colors ${
                        isChecked
                          ? 'bg-brand-50 border-brand-300 text-brand-900 dark:bg-brand-950 dark:border-brand-800 dark:text-brand-300'
                          : 'bg-background border-border text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      <span
                        className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[10px] ${
                          isChecked ? 'bg-primary text-white' : 'border border-border'
                        }`}
                      >
                        {isChecked && '✓'}
                      </span>
                      <span className="truncate">{amenity}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => {
                  setEditingType(null);
                  setIsCreateModalOpen(false);
                }}
                className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-brand-800 font-semibold shadow-subtle transition-colors"
              >
                Save Category
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
