import React, { useState } from 'react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { Device } from '../types';

interface Props {
  device: Device;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ClosureModal({ device, onClose, onSuccess }: Props) {
  const [closureType, setClosureType] = useState('');
  const [policeReportRef, setPoliceReportRef] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [gaTransactionId, setGaTransactionId] = useState('');
  const [verifierName, setVerifierName] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!closureType) { toast.error('Select closure type'); return; }

    setSubmitting(true);
    try {
      await api.post(`/devices/${device.id}/close`, {
        closureType,
        policeReportRef: policeReportRef || undefined,
        receiptNumber: receiptNumber || undefined,
        gaTransactionId: gaTransactionId || undefined,
        verifierName: verifierName || undefined,
        notes: notes || undefined,
      });
      toast.success('Device closed successfully');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Closure failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white">
          <h2 className="text-lg font-bold text-gray-900">Close Device</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        <div className="px-6 py-3 bg-gray-50 border-b">
          <div className="text-sm">
            <span className="font-medium text-gray-700">Device: </span>
            <span className="font-mono text-zamtel-green">{device.dealerCode}</span>
          </div>
          <div className="text-sm text-gray-500 mt-1 capitalize">Current status: {device.status.replace(/_/g, ' ')}</div>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Closure Type *</label>
            <select
              value={closureType}
              onChange={e => setClosureType(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zamtel-green"
            >
              <option value="">Select type...</option>
              <option value="lost_stolen">Lost / Stolen</option>
              <option value="damaged">Damaged</option>
              <option value="inactive_resolved">Inactive – Resolved</option>
            </select>
          </div>

          {closureType === 'lost_stolen' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Police Report Reference *</label>
              <input
                type="text"
                value={policeReportRef}
                onChange={e => setPoliceReportRef(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zamtel-green"
                placeholder="Police report number"
              />
            </div>
          )}

          {closureType === 'damaged' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Receipt Number</label>
              <input
                type="text"
                value={receiptNumber}
                onChange={e => setReceiptNumber(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zamtel-green"
                placeholder="Receipt / evidence number"
              />
            </div>
          )}

          {closureType === 'inactive_resolved' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">GA Transaction ID</label>
              <input
                type="text"
                value={gaTransactionId}
                onChange={e => setGaTransactionId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zamtel-green"
                placeholder="Transaction ID"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Verifier Name</label>
            <input
              type="text"
              value={verifierName}
              onChange={e => setVerifierName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zamtel-green"
              placeholder="Your name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zamtel-green"
              placeholder="Additional notes..."
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="flex-1 px-4 py-2 bg-zamtel-pink text-white rounded-lg text-sm font-medium hover:bg-zamtel-pink-dark disabled:opacity-50">
              {submitting ? 'Closing...' : 'Close Device'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
