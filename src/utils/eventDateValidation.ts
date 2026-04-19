export function getCurrentMinuteDate(): Date {
  const now = new Date();
  now.setSeconds(0, 0);
  return now;
}

export function toDateTimeLocalValue(dateLike: Date | string | number = new Date()): string {
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function parseDateTimeInput(value?: string | null): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function validateEventSchedule(
  eventDate: string,
  endAt?: string | null,
): string | null {
  const start = parseDateTimeInput(eventDate);
  if (!start) {
    return 'A data de início é inválida.';
  }

  if (start.getTime() < getCurrentMinuteDate().getTime()) {
    return 'A data de início deve ser no presente ou no futuro.';
  }

  if (endAt) {
    const end = parseDateTimeInput(endAt);
    if (!end) {
      return 'A data de término é inválida.';
    }

    if (end.getTime() < start.getTime()) {
      return 'A data de término deve ser maior ou igual à data de início.';
    }
  }

  return null;
}

type TicketSaleWindowOptions = {
  requireFutureStart?: boolean;
};

export function validateTicketSaleWindow(
  saleStartDate?: string | null,
  saleEndDate?: string | null,
  eventStartDate?: string | null,
  eventEndDate?: string | null,
  options: TicketSaleWindowOptions = {},
): string | null {
  const saleStart = parseDateTimeInput(saleStartDate);
  const saleEnd = parseDateTimeInput(saleEndDate);
  const eventStart = parseDateTimeInput(eventStartDate);
  const eventEnd = parseDateTimeInput(eventEndDate || eventStartDate);

  if (saleStartDate && !saleStart) {
    return 'A data de início das vendas é inválida.';
  }

  if (saleEndDate && !saleEnd) {
    return 'A data de término das vendas é inválida.';
  }

  if (saleStart && options.requireFutureStart && saleStart.getTime() < getCurrentMinuteDate().getTime()) {
    return 'A data de início das vendas deve ser no presente ou no futuro.';
  }

  if (saleStart && saleEnd && saleEnd.getTime() < saleStart.getTime()) {
    return 'A data de término das vendas deve ser maior ou igual à data de início das vendas.';
  }

  if (saleEnd && eventEnd && saleEnd.getTime() > eventEnd.getTime()) {
    return 'A data de término das vendas não pode ser depois do fim do evento.';
  }

  return null;
}
