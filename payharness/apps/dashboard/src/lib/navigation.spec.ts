import { navigateTopLevel } from './navigation';

describe('navigateTopLevel', () => {
  it('navigates through the browser target instead of reading a cross-origin frame', () => {
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    navigateTopLevel('https://www.paypal.com/checkout');

    expect(click).toHaveBeenCalledTimes(1);
    const anchor = click.mock.instances[0] as HTMLAnchorElement;
    expect(anchor.target).toBe('_top');
    expect(anchor.rel).toBe('noopener noreferrer');
    expect(anchor.href).toBe('https://www.paypal.com/checkout');

    click.mockRestore();
  });
});
