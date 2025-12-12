from collections import OrderedDict
from collections.abc import Hashable
from typing import Generic, TypeVar

K = TypeVar("K", bound=Hashable)
V = TypeVar("V")


class Cache(Generic[K, V]):
    cache: OrderedDict[K, V]

    def __init__(self, max_size: int = 1000) -> None:
        self.cache = OrderedDict()
        self.max_size = max_size

    def get(self, key: K) -> V | None:
        return self.cache.get(key)

    def set(self, key: K, value: V) -> None:
        self.cache[key] = value
        if len(self.cache) > self.max_size:
            self.cache.popitem(last=False)

    def purge(self) -> None:
        self.cache.clear()
