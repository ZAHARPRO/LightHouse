<?php

namespace App\Entity;

use App\Repository\VideoRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: VideoRepository::class)]
class Video
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: 255)]
    private ?string $title = null;

    #[ORM\Column(length: 255, nullable: true)]
    private ?string $description = null;

    #[ORM\Column(nullable: true)]
    private ?int $likesCount = null;

    #[ORM\Column(nullable: true)]
    private ?int $viewsCount = null;

    /**
     * @var Collection<int, FeedItem>
     */
    #[ORM\OneToMany(mappedBy: 'video', targetEntity: FeedItem::class, orphanRemoval: true)]
    private Collection $feedItems;

    #[ORM\ManyToOne(inversedBy: 'videos')]
    #[ORM\JoinColumn(nullable: false)]
    private ?User $user = null;

    public function __construct()
    {
        $this->feedItems = new ArrayCollection();
    }


    public function getId(): ?int
    {
        return $this->id;
    }

    public function getTitle(): ?string
    {
        return $this->title;
    }

    public function setTitle(string $title): static
    {
        $this->title = $title;

        return $this;
    }

    public function getDescription(): ?string
    {
        return $this->description;
    }

    public function setDescription(?string $description): static
    {
        $this->description = $description;

        return $this;
    }

    public function getLikesCount(): ?int
    {
        return $this->likesCount;
    }

    public function setLikesCount(?int $likesCount): static
    {
        $this->likesCount = $likesCount;

        return $this;
    }

    public function getViewsCount(): ?int
    {
        return $this->viewsCount;
    }

    public function setViewsCount(?int $viewsCount): static
    {
        $this->viewsCount = $viewsCount;

        return $this;
    }

    /**
     * @return Collection<int, FeedItem>
     */
    public function getFeedItems(): Collection
    {
        return $this->feedItems;
    }

    public function addFeedItem(FeedItem $feedItem): static
    {
        if (!$this->feedItems->contains($feedItem)) {
            $this->feedItems->add($feedItem);
            $feedItem->setVideo($this);
        }

        return $this;
    }

    public function removeFeedItem(FeedItem $feedItem): static
    {
        if ($this->feedItems->removeElement($feedItem)) {
            // set the owning side to null (unless already changed)
            if ($feedItem->getVideo() === $this) {
                $feedItem->setVideo(null);
            }
        }

        return $this;
    }

    public function getUser(): ?User
    {
        return $this->user;
    }

    public function setUser(?User $user): static
    {
        $this->user = $user;

        return $this;
    }


}