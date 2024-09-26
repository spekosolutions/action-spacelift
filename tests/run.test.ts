import { main } from '../src/main.js'

test('main successfully', async () => {
  await expect(main(
    { 
      command: 'foo',
      spacelift_url: 'foo',
      region: 'foo',
      env: 'foo',
      service_name: 'foo',
      label_prefix: 'foo',
      label_postfix: 'foo'
    }
  )).resolves.toBeUndefined()
})